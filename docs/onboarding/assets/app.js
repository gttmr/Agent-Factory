const TOC = [
  {
    group: "시작하기",
    items: [
      { id: "index", title: "0. 이 가이드 사용법", href: "index.html" },
      { id: "01", title: "1. ADK 기본 개념", href: "01-concepts.html" },
    ],
  },
  {
    group: "워크벤치 사용",
    items: [
      { id: "02", title: "2. 워크벤치 한 바퀴", href: "02-workbench-tour.html" },
      { id: "03", title: "3. Taxonomy 결정", href: "03-taxonomy.html" },
      { id: "04", title: "4. Workflow 종류 고르기", href: "04-workflow-decision.html" },
      { id: "05", title: "5. Process Flow와 Graph IR", href: "05-process-flow.html" },
    ],
  },
  {
    group: "검토와 핸드오프",
    items: [
      { id: "06", title: "6. Design Review", href: "06-review-board.html" },
      { id: "07", title: "7. Runtime 계약", href: "07-runtime-contracts.html" },
      { id: "08", title: "8. Build와 Verify", href: "08-validation-handoff.html" },
    ],
  },
  {
    group: "참고",
    items: [
      { id: "09", title: "9. 용어집", href: "09-glossary.html" },
    ],
  },
];

function renderSidebar(activeId) {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = `
    <div class="sidebar-brand">
      <a href="index.html" style="color:inherit; text-decoration:none;">
        <div class="logo">Agent Factory</div>
        <div class="subtitle">AI DLC for Agents 온보딩 가이드</div>
      </a>
    </div>
    ${TOC.map(group => `
      <div class="toc-group-label">${group.group}</div>
      <ul class="toc">
        ${group.items.map(item => `
          <li>
            <a href="${item.href}" class="${item.id === activeId ? 'active' : ''}">${item.title}</a>
          </li>
        `).join("")}
      </ul>
    `).join("")}
  `;
}

function renderPager(activeId) {
  const all = TOC.flatMap(g => g.items);
  const idx = all.findIndex(x => x.id === activeId);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const pager = document.querySelector(".pager");
  if (!pager) return;
  pager.innerHTML = `
    <a href="${prev ? prev.href : '#'}" class="prev ${prev ? '' : 'disabled'}">
      <span class="label">이전</span>
      <span class="title">${prev ? prev.title : ''}</span>
    </a>
    <a href="${next ? next.href : '#'}" class="next ${next ? '' : 'disabled'}">
      <span class="label">다음</span>
      <span class="title">${next ? next.title : ''}</span>
    </a>
  `;
}

function setupMobileMenu() {
  const toggle = document.createElement("button");
  toggle.className = "mobile-menu-toggle";
  toggle.innerText = "☰ 목차";
  toggle.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.toggle("open");
  });
  document.body.appendChild(toggle);
  document.addEventListener("click", (e) => {
    const sidebar = document.querySelector(".sidebar");
    if (!sidebar?.classList.contains("open")) return;
    if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
    sidebar.classList.remove("open");
  });
}

function initPage(activeId) {
  renderSidebar(activeId);
  renderPager(activeId);
  setupMobileMenu();
  initQuizzes();
  initClassifiers();
  initGlossarySearch();
}

function initQuizzes() {
  document.querySelectorAll(".quiz").forEach(quiz => {
    const correct = quiz.dataset.correct;
    const explanation = quiz.querySelector(".quiz-feedback");
    quiz.querySelectorAll(".quiz-options button").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.value;
        quiz.querySelectorAll(".quiz-options button").forEach(b => {
          b.classList.remove("correct", "incorrect");
          b.disabled = true;
        });
        if (val === correct) {
          btn.classList.add("correct");
        } else {
          btn.classList.add("incorrect");
          const correctBtn = quiz.querySelector(`.quiz-options button[data-value="${correct}"]`);
          correctBtn?.classList.add("correct");
        }
        explanation?.classList.add("show");
      });
    });
  });
}

function initClassifiers() {
  document.querySelectorAll(".classifier").forEach(form => {
    const verdictEl = form.querySelector(".verdict");
    const rules = (form.dataset.rules || "").split("|").map(r => {
      const [keys, label, why] = r.split("::");
      return { keys: keys.split(","), label, why };
    });
    const update = () => {
      const checked = Array.from(form.querySelectorAll("input[type=checkbox]:checked")).map(i => i.value);
      form.querySelectorAll(".options label").forEach(l => {
        const cb = l.querySelector("input");
        l.classList.toggle("selected", cb?.checked);
      });
      if (!checked.length) {
        verdictEl?.classList.remove("show");
        return;
      }
      let best = null;
      let bestScore = 0;
      rules.forEach(rule => {
        const score = rule.keys.filter(k => checked.includes(k)).length;
        if (score > bestScore) { best = rule; bestScore = score; }
      });
      if (!best || !verdictEl) return;
      verdictEl.innerHTML = `<h5>제안: ${best.label}</h5><p>${best.why}</p>`;
      verdictEl.classList.add("show");
    };
    form.querySelectorAll("input[type=checkbox]").forEach(cb => cb.addEventListener("change", update));
  });
}

function initGlossarySearch() {
  const input = document.querySelector(".glossary-search");
  if (!input) return;
  input.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".glossary-entry").forEach(entry => {
      const text = entry.innerText.toLowerCase();
      entry.classList.toggle("hidden", q.length > 0 && !text.includes(q));
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const activeId = document.body.dataset.page || "";
  initPage(activeId);
});
