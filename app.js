// ===================================================
// Firebase 초기화 및 Firestore 연동
// Firebase SDK v9 modular 방식(CDN)을 사용합니다.
// ===================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { 
  getAuth, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyDyRhtYtTxj9r3me9CzSCGsgEXsL2eUMww",
  authDomain: "test-class-wall.firebaseapp.com",
  projectId: "test-class-wall",
  storageBucket: "test-class-wall.firebasestorage.app",
  messagingSenderId: "513030272397",
  appId: "1:513030272397:web:5b421b2f125280f0e579c4",
  measurementId: "G-PNWNB025TL"
};

// Firebase, Firestore, Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const memosCollection = collection(db, "memos");

// 현재 로그인한 사용자 정보 및 역할
let currentUser = null;
let userRole = "student"; // 기본은 student, teacher인 경우 teacher

// 교사 계정 여부 확인 (지정된 관리자 이메일 또는 Firestore role 기준)
const TEACHER_EMAIL = "yunyoung.so@gmail.com";

function isTeacher() {
  return userRole === "teacher" || (currentUser && currentUser.email === TEACHER_EMAIL);
}

// ===================================================
// 로그인 영역 UI 관리
// ===================================================
const userArea = document.getElementById("userArea");

function renderUserArea() {
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    // 로그인된 상태
    const roleText = isTeacher() ? "🍎 교사" : "✏️ 학생";
    const greeting = document.createElement("span");
    greeting.textContent = `[${roleText}] ${currentUser.displayName || currentUser.email || "사용자"}님 환영합니다! `;
    greeting.style.marginRight = "10px";

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (error) {
        console.error("로그아웃 실패:", error);
      }
    });

    userArea.appendChild(greeting);
    userArea.appendChild(logoutBtn);
  } else {
    // 로그아웃된 상태
    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google 계정으로 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (error) {
        console.error("Google 로그인 실패:", error);
        alert("로그인에 실패했습니다: " + error.message);
      }
    });

    userArea.appendChild(loginBtn);
  }
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  if (currentUser && currentUser.email === TEACHER_EMAIL) {
    userRole = "teacher";
  } else {
    userRole = "student";
  }
  renderUserArea();
  render(); // 로그인 상태에 따라 삭제 버튼 등 재렌더링
});


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore 데이터베이스를 사용하여 메모를 읽고 쓰고 지웁니다.
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 createdAt 기준 오름차순으로 정렬하여 가져옵니다.
async function loadMemos() {
  try {
    const q = query(memosCollection, orderBy("createdAt", "asc"));
    const querySnapshot = await getDocs(q);
    const loaded = [];
    querySnapshot.forEach(function (docSnap) {
      loaded.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });
    return loaded;
  } catch (error) {
    console.error("메모를 불러오는 중 오류가 발생했습니다:", error);
    return [];
  }
}

// 메모를 새로 씁니다.
// 학생과 교사 모두 로그인 후 작성 가능하며, uid와 작성자 이름이 함께 저장됩니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 계정으로 로그인해야 합니다.");
    return false;
  }

  if (text.length < 5) {
    alert("메모는 5글자 이상 입력해야 합니다.");
    return false;
  }

  try {
    await addDoc(memosCollection, {
      text: text,
      createdAt: Date.now(),
      uid: currentUser.uid,
      authorName: currentUser.displayName || currentUser.email.split("@")[0] || "익명"
    });
    return true;
  } catch (error) {
    console.error("메모를 추가하는 중 오류가 발생했습니다:", error);
    alert("메모 저장 실패: " + error.message);
    return false;
  }
}

// 메모를 지웁니다.
// 교사만 모든 메모를 삭제할 수 있습니다. (학생은 타인의 것은 물론 삭제 권한 없음)
async function deleteMemo(id) {
  if (!isTeacher()) {
    alert("메모 삭제 권한이 없습니다. 교사만 삭제할 수 있습니다.");
    return;
  }

  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모를 삭제하는 중 오류가 발생했습니다:", error);
    alert("삭제 실패: " + error.message);
  }
}

// AI 코멘트를 생성하고 Firestore에 저장합니다 (교사 전용)
// Vercel 서버리스 함수(/api/gemini)를 호출합니다.
async function generateAIComment(memo) {
  if (!isTeacher()) {
    alert("AI 코멘트 생성 권한이 없습니다. 교사만 실행할 수 있습니다.");
    return;
  }

  try {
    // 개인정보 보호: 학생 식별 정보(uid, email 등)는 보내지 않고 순수 내용(text)만 전송
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: memo.text })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `서버 에러 (${response.status})`);
    }

    const data = await response.json();
    const comment = data.comment;

    // Firestore 해당 메모 문서에 aiComment 필드 업데이트
    await updateDoc(doc(db, "memos", memo.id), {
      aiComment: comment
    });

    await render();
  } catch (error) {
    console.error("AI 코멘트 생성 오류:", error);
    alert("AI 코멘트 생성 중 오류가 발생했습니다: " + error.message);
  }
}


// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();
  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 교사에게만 삭제(×) 버튼 노출
  if (isTeacher()) {
    const del = document.createElement("button");
    del.className = "del-btn";
    del.textContent = "×";
    del.title = "교사 권한으로 삭제";
    del.addEventListener("click", async function () {
      if (confirm("이 메모를 삭제하시겠습니까?")) {
        await deleteMemo(memo.id);
        await render();
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("div");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보 표시
  if (memo.authorName) {
    const meta = document.createElement("div");
    meta.className = "memo-meta";
    meta.textContent = `작성자: ${memo.authorName}`;
    div.appendChild(meta);
  }

  // AI 코멘트가 이미 있는 경우 표시
  if (memo.aiComment) {
    const aiBox = document.createElement("div");
    aiBox.className = "ai-box";
    
    const aiHeader = document.createElement("div");
    aiHeader.className = "ai-header";
    aiHeader.textContent = "🤖 AI 선생님의 한마디";
    aiBox.appendChild(aiHeader);

    const aiContent = document.createElement("div");
    aiContent.textContent = memo.aiComment;
    aiBox.appendChild(aiContent);

    div.appendChild(aiBox);
  }

  // 교사에게만 "AI 코멘트 달기" 버튼 노출
  if (isTeacher()) {
    const aiBtn = document.createElement("button");
    aiBtn.className = "ai-btn";
    aiBtn.textContent = memo.aiComment ? "✨ AI 코멘트 다시 받기" : "🤖 AI 코멘트 달기";
    aiBtn.addEventListener("click", async function () {
      aiBtn.disabled = true;
      aiBtn.textContent = "⏳ 코멘트 생성 중...";
      await generateAIComment(memo);
    });
    div.appendChild(aiBtn);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    const text = input.value.trim();
    if (text === "") return;

    const success = await addMemo(text);
    if (success) {
      input.value = "";
      await render();
    }
  }
});


// 첫 화면 그리기
render();
input.focus();
