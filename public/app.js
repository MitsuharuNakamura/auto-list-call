
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const errorDiv = document.getElementById('error');
  const callsTable = document.getElementById('callsTable');
  const tableBody = callsTable.querySelector('tbody');
  const configDiv = document.getElementById('config');
  const messageInput = document.getElementById('messageInput');
  const languageSelect = document.getElementById('languageSelect');
  const voiceSelect = document.getElementById('voiceSelect');
  const startBtn = document.getElementById('startBtn');
  const progressDiv = document.getElementById('progress');

  let callsList = [];

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      complete: (results) => {
        const data = results.data;
        if (data.some(row => row.length !== 2)) {
          showError('CSVのフォーマットが不正です。名前と電話番号がカンマ区切りになっていることを確認してください。');
          return;
        }
        callsList = data.map(([name, phone]) => ({name: name.trim(), phone: phone.trim()})).filter(item => item.name && item.phone);
        if (callsList.length === 0) {
          showError('CSVに有効なデータがありません。');
          return;
        }
        hideError();
        renderTable();
        configDiv.classList.remove('d-none');
        callsTable.classList.remove('d-none');
        checkStartEnabled();
      },
      error: () => {
        showError('CSVの読み込みに失敗しました。');
      }
    });
  });

  messageInput.addEventListener('input', checkStartEnabled);

  startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    fileInput.disabled = true;
    const payload = {
      calls: callsList,
      message: messageInput.value.trim(),
      language: languageSelect.value,
      voice: voiceSelect.value
    };
    fetch('/start-calls', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(res => res.json())
      .then(() => {
        const es = new EventSource('/events');
        es.addEventListener('callResult', (e) => {
          const {index, status} = JSON.parse(e.data);
          const cell = tableBody.rows[index].cells[3];
          cell.textContent = status;
          cell.classList.add(status === 'OK' ? 'text-success' : 'text-danger');
        });
        es.addEventListener('progress', (e) => {
          const {completed, total} = JSON.parse(e.data);
          progressDiv.textContent = `進行状況: ${completed} / ${total}`;
        });
        es.addEventListener('complete', () => {
          progressDiv.textContent = '全ての通話が完了しました。';
          es.close();
        });
      }).catch(() => {
        showError('通話の開始に失敗しました。');
      });
  });

  function renderTable() {
    tableBody.innerHTML = '';
    callsList.forEach((item, idx) => {
      const row = tableBody.insertRow();
      row.insertCell(0).textContent = idx + 1;
      row.insertCell(1).textContent = item.name;
      row.insertCell(2).textContent = item.phone;
      row.insertCell(3).textContent = '';
    });
  }

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.classList.remove('d-none');
  }

  function hideError() {
    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
  }

  function checkStartEnabled() {
    startBtn.disabled = !(callsList.length > 0 && messageInput.value.trim().length > 0);
  }
});