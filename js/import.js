// Import Module (Local Sheet Music Upload / Scan)

const ImportModule = {
  modal: null,
  videoEl: null,
  canvasEl: null,
  previewEl: null,
  pdfPreviewEl: null,
  fileInput: null,
  stream: null,
  capturedBase64: null,
  selectedMimeType: null,

  init() {
    this.modal = document.getElementById('import-modal');
    this.videoEl = document.getElementById('import-camera-video');
    this.canvasEl = document.getElementById('import-camera-canvas');
    this.previewEl = document.getElementById('import-preview');
    this.pdfPreviewEl = document.getElementById('import-pdf-preview');
    this.fileInput = document.getElementById('import-file-input');

    const btnOpen = document.getElementById('btn-import-modal');
    const btnClose = document.getElementById('btn-close-import');
    const btnFile = document.getElementById('btn-import-file');
    const btnCamera = document.getElementById('btn-import-camera');
    const btnCapture = document.getElementById('btn-capture-camera');
    const btnSave = document.getElementById('btn-import-save');

    if (btnOpen) btnOpen.addEventListener('click', () => this.openModal());
    if (btnClose) btnClose.addEventListener('click', () => this.closeModal());
    if (btnFile) btnFile.addEventListener('click', () => this.fileInput.click());
    if (btnCamera) btnCamera.addEventListener('click', () => this.startCamera());
    if (btnCapture) btnCapture.addEventListener('click', () => this.captureCamera());
    if (btnSave) btnSave.addEventListener('click', () => this.saveToLocal());

    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
  },

  openModal() {
    this.resetState();
    this.modal.classList.add('open');
  },

  closeModal() {
    this.stopCamera();
    this.modal.classList.remove('open');
  },

  resetState() {
    this.stopCamera();
    this.capturedBase64 = null;
    this.selectedMimeType = null;
    if (this.fileInput) this.fileInput.value = '';
    
    document.getElementById('import-name').value = '';
    this.videoEl.style.display = 'none';
    this.previewEl.style.display = 'none';
    this.pdfPreviewEl.style.display = 'none';
    document.getElementById('btn-capture-camera').style.display = 'none';
  },

  handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    this.stopCamera();
    this.videoEl.style.display = 'none';
    document.getElementById('btn-capture-camera').style.display = 'none';

    this.selectedMimeType = file.type;

    const reader = new FileReader();
    reader.onload = () => {
      this.capturedBase64 = reader.result;
      if (file.type.startsWith('image/')) {
        this.previewEl.src = reader.result;
        this.previewEl.style.display = 'block';
        this.pdfPreviewEl.style.display = 'none';
      } else {
        this.previewEl.style.display = 'none';
        this.pdfPreviewEl.style.display = 'block';
      }
    };
    reader.readAsDataURL(file);

    const nameInput = document.getElementById('import-name');
    if (!nameInput.value) {
      nameInput.value = file.name.replace(/\.[^/.]+$/, ""); // remove extension
    }
  },

  async startCamera() {
    this.resetState();
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      this.videoEl.srcObject = this.stream;
      this.videoEl.style.display = 'block';
      document.getElementById('btn-capture-camera').style.display = 'block';
    } catch (e) {
      App.showToast('ไม่สามารถเปิดกล้องได้: ' + e.message, 'error');
    }
  },

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  },

  captureCamera() {
    if (!this.stream) return;
    
    this.canvasEl.width = this.videoEl.videoWidth || 640;
    this.canvasEl.height = this.videoEl.videoHeight || 480;
    const ctx = this.canvasEl.getContext('2d');
    ctx.drawImage(this.videoEl, 0, 0, this.canvasEl.width, this.canvasEl.height);
    
    this.capturedBase64 = this.canvasEl.toDataURL('image/jpeg', 0.8);
    this.selectedMimeType = 'image/jpeg';
    
    this.stopCamera();
    this.videoEl.style.display = 'none';
    document.getElementById('btn-capture-camera').style.display = 'none';
    
    this.previewEl.src = this.capturedBase64;
    this.previewEl.style.display = 'block';
  },

  saveToLocal() {
    const name = document.getElementById('import-name').value.trim();
    if (!name) {
      App.showToast('กรุณากรอกชื่อเพลง', 'error');
      return;
    }
    if (!this.capturedBase64) {
      App.showToast('กรุณาเลือกไฟล์หรือถ่ายรูปก่อน', 'error');
      return;
    }

    const newSong = {
      id: 'local_' + Date.now(),
      name: name,
      url: this.capturedBase64, // Keep full dataurl for local use
      mime_type: this.selectedMimeType,
      isLocal: true,
      created_at: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem('ncs_local_songs') || '[]');
      existing.push(newSong);
      localStorage.setItem('ncs_local_songs', JSON.stringify(existing));
      
      App.showToast('บันทึกเพลงลงในเครื่องสำเร็จ!', 'success');
      this.closeModal();

      // Refresh Library
      if (window.Library) {
        Library.loadSongs();
      }
    } catch (e) {
      // LocalStorage might be full (5MB limit)
      console.error(e);
      App.showToast('เกิดข้อผิดพลาด: พื้นที่จัดเก็บในเบราว์เซอร์อาจเต็ม', 'error');
    }
  },

  getLocalSongs() {
    try {
      return JSON.parse(localStorage.getItem('ncs_local_songs') || '[]');
    } catch (e) {
      return [];
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ImportModule.init();
});
