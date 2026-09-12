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
  doc, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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

// Firebase 및 Firestore 인스턴스 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const memosCollection = collection(db, "memos");


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
// Firestore의 memos 컬렉션에 새 문서를 추가합니다.
async function addMemo(text) {
  try {
    await addDoc(memosCollection, {
      text: text,
      createdAt: Date.now()
    });
  } catch (error) {
    console.error("메모를 추가하는 중 오류가 발생했습니다:", error);
  }
}

// 메모를 지웁니다.
// Firestore에서 해당 id(문서 ID)의 문서를 삭제합니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (error) {
    console.error("메모를 삭제하는 중 오류가 발생했습니다:", error);
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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

    input.value = "";
    await addMemo(text);
    await render();
  }
});


// 첫 화면 그리기
render();
input.focus();
