const exprLine = document.getElementById('exprLine');
const resultLine = document.getElementById('resultLine');
const modeTag = document.getElementById('modeTag');
const memTag = document.getElementById('memTag');
const shiftBtn = document.getElementById('shiftBtn');
const angleBtn = document.getElementById('angleBtn');
const historyList = document.getElementById('historyList');
const refreshBtn = document.getElementById('refreshBtn');

let expr = '';
let lastResult = 0;
let memory = 0;
let shiftOn = false;
let angleMode = 'deg'; // 'deg' or 'rad'

function renderExpr() {
  exprLine.textContent = expr || '0';
}

function renderMemTag() {
  memTag.textContent = memory !== 0 ? 'M' : '';
}

function toggleShift() {
  shiftOn = !shiftOn;
  shiftBtn.classList.toggle('active', shiftOn);
  document.querySelectorAll('.k-fn[data-primary]').forEach(btn => {
    const label = shiftOn ? btn.dataset.shiftLabel : btn.dataset.label;
    btn.textContent = label;
    btn.classList.toggle('shifted', shiftOn);
  });
  const squareBtn = document.querySelector('[data-action="square"]');
  if (squareBtn) {
    squareBtn.textContent = shiftOn ? squareBtn.dataset.shiftLabel : squareBtn.dataset.label;
    squareBtn.classList.toggle('shifted', shiftOn);
  }
}

function toggleAngleMode() {
  angleMode = angleMode === 'deg' ? 'rad' : 'deg';
  angleBtn.textContent = angleMode.toUpperCase();
  modeTag.textContent = angleMode.toUpperCase();
  angleBtn.classList.toggle('active', angleMode === 'rad');
}

function insertText(text) {
  expr += text;
  renderExpr();
}

function backspace() {
  expr = expr.slice(0, -1);
  renderExpr();
}

function clearAll() {
  expr = '';
  resultLine.innerHTML = '&nbsp;';
  renderExpr();
}

// يحوّل استدعاءات الدوال المثلثية حسب وضع الزاوية (درجة/راديان)
// direct: sin/cos/tan تحتاج للتحويل لراديان قبل الحساب
// inverse: asin/acos/atan بترجع راديان ولازم تتحول لدرجة بعد الحساب
function applyAngleMode(expression) {
  if (angleMode === 'rad') return expression;

  const direct = ['sin', 'cos', 'tan'];
  const inverse = ['asin', 'acos', 'atan'];
  const all = [...direct, ...inverse].sort((a, b) => b.length - a.length);

  function transform(str) {
    let result = '';
    let i = 0;
    while (i < str.length) {
      let matched = false;
      for (const fn of all) {
        const token = fn + '(';
        if (str.startsWith(token, i) && !/[a-zA-Z]/.test(str[i - 1] || '')) {
          const start = i + token.length;
          let depth = 1;
          let j = start;
          while (j < str.length && depth > 0) {
            if (str[j] === '(') depth++;
            else if (str[j] === ')') depth--;
            j++;
          }
          const inner = str.slice(start, j - 1);
          const innerTransformed = transform(inner);
          if (direct.includes(fn)) {
            result += `${fn}((${innerTransformed}) deg)`;
          } else {
            result += `(${fn}(${innerTransformed}) * 180 / pi)`;
          }
          i = j;
          matched = true;
          break;
        }
      }
      if (!matched) {
        result += str[i];
        i++;
      }
    }
    return result;
  }

  return transform(expression);
}

async function calculate() {
  if (!expr) return;
  const toSend = applyAngleMode(expr);

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: toSend })
    });
    const data = await res.json();

    if (!res.ok) {
      resultLine.textContent = data.error || 'خطأ';
      return;
    }

    lastResult = data.result;
    resultLine.textContent = formatNumber(data.result);
    loadHistory();
  } catch (err) {
    resultLine.textContent = 'مش قادر أوصل للسيرفر';
  }
}

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1e10) / 1e10);
}

function handleAction(action) {
  switch (action) {
    case 'shift': toggleShift(); break;
    case 'anglemode': toggleAngleMode(); break;
    case 'ac': clearAll(); break;
    case 'del': backspace(); break;
    case 'equals': calculate(); break;
    case 'ans': insertText(String(lastResult)); break;
    case 'percent': insertText('/100'); break;
    case 'square': insertText(shiftOn ? '^3' : '^2'); break;
    case 'mc': memory = 0; renderMemTag(); break;
    case 'mr': insertText(String(memory)); break;
    case 'mplus': memory += lastResult; renderMemTag(); break;
    case 'mminus': memory -= lastResult; renderMemTag(); break;
  }
}

document.querySelectorAll('.k').forEach(btn => {
  btn.addEventListener('click', () => {
    const { action, insert, primary, shift } = btn.dataset;

    if (primary) {
      insertText(shiftOn ? shift : primary);
      return;
    }
    if (action) {
      handleAction(action);
      return;
    }
    if (insert !== undefined) {
      insertText(insert);
    }
  });
});

async function loadHistory() {
  try {
    const res = await fetch('/api/history');
    const rows = await res.json();

    historyList.innerHTML = '';
    if (rows.length === 0) {
      historyList.innerHTML = '<li class="empty">لسه معملتش أي عملية</li>';
      return;
    }

    rows.forEach(row => {
      const li = document.createElement('li');
      const date = new Date(row.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      li.innerHTML = `
        <span class="h-expr">${row.expression}</span>
        <div class="h-result-row">
          <span class="h-result">= ${formatNumber(row.result)}</span>
          <span class="h-time">${date}</span>
          <button class="del-btn" data-id="${row.id}">حذف</button>
        </div>
      `;
      historyList.appendChild(li);
    });

    document.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/history/${btn.dataset.id}`, { method: 'DELETE' });
        loadHistory();
      });
    });
  } catch (err) {
    console.error(err);
  }
}

refreshBtn.addEventListener('click', loadHistory);
modeTag.classList.add('active');
loadHistory();
