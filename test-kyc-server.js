const http = require('http');
const os = require('os');

// Obter o IP local da rede Wi-Fi / Ethernet
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const ip = getLocalIp();
const port = 8080;

// IMPORTANTE: Em telemóveis, o acesso à câmara só é permitido em HTTPS ou localhost.
const phoneUrl = `http://${ip}:${port}/camera`;

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    // Página para o PC: Mostra o QR Code para o telemóvel scanear
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="pt">
        <head>
          <meta charset="UTF-8">
          <title>Teste KYC - PC</title>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
          <style>
            body { font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0a0f1e; color: white; margin: 0; }
            h2 { color: #f5a623; }
            .card { background: #111827; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }
            #qrcode { margin: 20px auto; background: white; padding: 20px; border-radius: 10px; display: inline-block; }
            .warning { margin-top: 15px; font-size: 14px; color: #aaa; max-width: 400px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Teste de KYC Facial</h2>
            <p>Faça scan deste código com a câmara do seu telemóvel:</p>
            <div id="qrcode"></div>
            <p>Ou abra este link no telemóvel:<br><br> <a href="${phoneUrl}" style="color: #22c55e; font-weight: bold;">${phoneUrl}</a></p>
            
            <p class="warning">
              ⚠️ <b>Nota sobre Telemóveis:</b><br>
              A maioria dos telemóveis bloqueia a câmara se o link não tiver <b>HTTPS</b>. Se a câmara não abrir no telemóvel, pare este servidor e execute no seu terminal o comando:<br>
              <code style="color:#f5a623; background:#000; padding:4px; border-radius:4px;">npx localtunnel --port 8080</code><br>
              e abra o link gerado no telemóvel.
            </p>
          </div>
          
          <script>
            new QRCode(document.getElementById("qrcode"), {
                text: "${phoneUrl}",
                width: 250,
                height: 250,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
          </script>
        </body>
      </html>
    `);
  } else if (req.url === '/camera') {
    // Página para o Telemóvel: Acede à câmara
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <!DOCTYPE html>
      <html lang="pt-AO">
        <head>
          <meta charset="UTF-8">
          <title>KYC - Dynamics Works</title>
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
          <script src="https://unpkg.com/lucide@latest"></script>
          <style>
            :root { 
                --primary: #f5a623; 
                --bg-main: #090e17; 
                --bg-panel: #111827; 
                --text-muted: #9ca3af;
                --success: #22c55e;
            }
            
            * { box-sizing: border-box; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
            
            body { 
                margin: 0; padding: 0; 
                background: radial-gradient(circle at top, #141e30 0%, var(--bg-main) 100%); 
                color: #fff; 
                display: flex; flex-direction: column; align-items: center; justify-content: center; 
                min-height: 100vh; overflow: hidden; 
            }
            
            /* Typography & Branding */
            .brand-header { color: var(--primary); font-weight: 800; font-size: 20px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 25px; text-align: center; }
            .brand-footer { position: fixed; bottom: 15px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #6b7280; letter-spacing: 0.5px; z-index: 100; pointer-events: none; }
            .brand-footer span { color: var(--primary); font-weight: bold; }
            
            h2 { margin: 0 0 8px; font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
            p.subtitle { color: var(--text-muted); font-size: 14px; margin: 0 0 25px; line-height: 1.5; }
            
            /* View Management */
            .view-section { display: none; flex-direction: column; align-items: center; width: 100%; max-width: 460px; padding: 20px; padding-bottom: 60px; z-index: 10; }
            .view-section.active { display: flex; animation: fadeSlideUp 0.4s ease-out forwards; }
            @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

            /* Cards & Content */
            .info-card { background: var(--bg-panel); border-radius: 24px; padding: 30px 20px; width: 100%; text-align: center; border: 1px solid rgba(255,255,255,0.03); box-shadow: 0 15px 35px rgba(0,0,0,0.4); }
            .icon-wrapper { display: flex; align-items: center; justify-content: center; width: 70px; height: 70px; background: rgba(245, 166, 35, 0.1); color: var(--primary); border-radius: 50%; margin: 0 auto 20px; }
            
            .instruction-list { background: rgba(0,0,0,0.25); border-radius: 16px; padding: 15px; margin-bottom: 25px; border: 1px solid rgba(255,255,255,0.02); text-align: left; }
            .instruction-item { display: flex; align-items: center; margin-bottom: 12px; font-size: 14px; font-weight: 500; }
            .instruction-item:last-child { margin-bottom: 0; }
            .instruction-item i { color: var(--primary); margin-right: 12px; }

            /* Camera UI */
            .cam-wrapper { position: relative; width: 100%; border-radius: 24px; overflow: hidden; background: #000; border: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            video { width: 100%; height: 50vh; min-height: 380px; object-fit: cover; display: block; }
            .cam-overlay-face { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 200px; height: 280px; border: 3px dashed rgba(255,255,255,0.5); border-radius: 110px; box-shadow: 0 0 0 2000px rgba(0,0,0,0.6); transition: border-color 0.3s; pointer-events: none; }
            .cam-overlay-bi { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 85%; height: 220px; border: 3px dashed rgba(255,255,255,0.5); border-radius: 12px; box-shadow: 0 0 0 2000px rgba(0,0,0,0.6); transition: border-color 0.3s; pointer-events: none; }
            
            .status-ring { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); border: 3px solid transparent; border-top-color: var(--primary); border-right-color: rgba(245,166,35,0.3); border-radius: 50%; pointer-events: none; display: none; }
            .status-ring.face { width: 230px; height: 310px; border-radius: 130px; }
            .status-ring.bi { width: calc(85% + 30px); height: 250px; border-radius: 20px; }
            .status-ring.active { display: block; animation: spin 1s linear infinite; }
            @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }

            .feedback-msg { color: var(--primary); font-weight: 600; font-size: 16px; text-align: center; min-height: 24px; margin-bottom: 15px; }

            /* Gallery / Review */
            .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 25px; width: 100%; }
            .gallery-item { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 8px; border: 1px solid rgba(255,255,255,0.05); }
            .gallery-item span { display: block; font-size: 11px; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; font-weight: 600; }
            .gallery-item img { width: 100%; border-radius: 8px; object-fit: cover; aspect-ratio: 4/3; }
            .img-face { transform: scaleX(-1); } /* Espelhar apenas as do rosto na galeria */

            /* Controls */
            .btn { width: 100%; padding: 16px; font-size: 15px; border: none; border-radius: 14px; font-weight: 600; cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 10px; transition: 0.2s; }
            .btn:active { transform: scale(0.97); }
            .btn:disabled { opacity: 0.5; pointer-events: none; }
            .btn-primary { background: var(--primary); color: #000; }
            .btn-secondary { background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.2); }
            .btn-success { background: var(--success); color: #fff; }
            
            .controls-group { display: flex; flex-direction: column; gap: 12px; width: 100%; }

            /* Desktop adjustments */
            @media (min-width: 768px) {
                .view-section { background: rgba(17, 24, 39, 0.7); backdrop-filter: blur(15px); border-radius: 24px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 25px 50px rgba(0,0,0,0.5); margin: 20px 0; padding-bottom: 30px; }
                .info-card { background: transparent; box-shadow: none; border: none; padding: 10px 0; }
                .brand-footer { bottom: 20px; }
            }
          </style>
        </head>
        <body>
          
          <div class="brand-header">Dynamics Works</div>

          <!-- LIVENESS: Instruções -->
          <div id="view-liveness-intro" class="view-section active">
            <div class="info-card">
              <div class="icon-wrapper"><i data-lucide="scan-face" style="width:36px; height:36px;"></i></div>
              <h2>Verificação Facial</h2>
              <p class="subtitle">Iremos capturar o seu rosto em diferentes ângulos para garantir a sua segurança.</p>
              
              <div class="instruction-list">
                <div class="instruction-item"><i data-lucide="sun"></i> Fique num ambiente claro</div>
                <div class="instruction-item"><i data-lucide="user"></i> Remova óculos e acessórios</div>
                <div class="instruction-item"><i data-lucide="smartphone"></i> Segure o dispositivo à altura dos olhos</div>
              </div>
              
              <button class="btn btn-primary" onclick="KYCApp.startLiveness()">
                <i data-lucide="camera"></i> Começar Captura Facial
              </button>
            </div>
          </div>

          <!-- LIVENESS: Captura -->
          <div id="view-liveness-cam" class="view-section">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 id="liveness-title">Posicione o Rosto</h2>
              <p class="subtitle" id="liveness-subtitle">Passo 1 de 3</p>
            </div>

            <div class="cam-wrapper">
              <video id="video-liveness" playsinline muted style="transform: scaleX(-1);"></video>
              <div class="cam-overlay-face" id="overlay-face"></div>
              <div class="status-ring face" id="ring-face"></div>
            </div>
            
            <div class="feedback-msg" id="liveness-msg">A aguardar estabilidade...</div>
          </div>

          <!-- BI: Instruções -->
          <div id="view-bi-intro" class="view-section">
            <div class="info-card">
              <div class="icon-wrapper"><i data-lucide="credit-card" style="width:36px; height:36px;"></i></div>
              <h2>Documento de Identidade</h2>
              <p class="subtitle">Agora, precisamos de fotos claras do seu Bilhete de Identidade Nacional.</p>
              
              <div class="instruction-list">
                <div class="instruction-item"><i data-lucide="layout"></i> Posicione o B.I. dentro da moldura</div>
                <div class="instruction-item"><i data-lucide="search"></i> Evite reflexos de luz no plástico</div>
                <div class="instruction-item"><i data-lucide="check-circle"></i> Todos os dados devem estar legíveis</div>
              </div>
              
              <button class="btn btn-primary" onclick="KYCApp.startBI()">
                <i data-lucide="camera"></i> Fotografar B.I.
              </button>
            </div>
          </div>

          <!-- BI: Captura -->
          <div id="view-bi-cam" class="view-section">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 id="bi-title">B.I. - Frente</h2>
              <p class="subtitle">Alinhe o documento na marcação</p>
            </div>

            <div class="cam-wrapper">
              <video id="video-bi" playsinline muted></video>
              <div class="cam-overlay-bi" id="overlay-bi"></div>
              <div class="status-ring bi" id="ring-bi"></div>
            </div>
            
            <div class="feedback-msg" id="bi-msg">Procurando documento...</div>
            
            <button class="btn btn-primary" id="btn-capture-bi" onclick="KYCApp.captureBI()" style="display:none;">
              <i data-lucide="aperture"></i> Tirar Foto
            </button>
          </div>

          <!-- REVISÃO FINAL -->
          <div id="view-review" class="view-section">
            <h2 style="text-align: center;">Revisão de Dados</h2>
            <p class="subtitle" style="text-align: center;">Confirme se todas as imagens estão legíveis.</p>
            
            <div class="gallery">
              <div class="gallery-item">
                <span>Rosto (Frontal)</span>
                <img id="res-face1" class="img-face" />
              </div>
              <div class="gallery-item">
                <span>Rosto (Lateral)</span>
                <img id="res-face2" class="img-face" />
              </div>
              <div class="gallery-item">
                <span>B.I. (Frente)</span>
                <img id="res-bi-front" />
              </div>
              <div class="gallery-item">
                <span>B.I. (Verso)</span>
                <img id="res-bi-back" />
              </div>
            </div>
            
            <div class="controls-group">
              <button class="btn btn-success" id="btn-submit" onclick="KYCApp.submitKYC()">
                <i data-lucide="shield-check"></i> Enviar para Verificação
              </button>
              <button class="btn btn-secondary" onclick="KYCApp.restart()">
                <i data-lucide="refresh-ccw"></i> Recomeçar Tudo
              </button>
            </div>
            
            <div id="submit-msg" style="margin-top: 15px; font-size: 14px; text-align: center;"></div>
          </div>

          <!-- Canvas Oculto para processamento -->
          <canvas id="engine-canvas" style="display: none;"></canvas>

          <div class="brand-footer">Desenvolvido pela <span>DIGIKAP</span></div>

          <script>
            lucide.createIcons();

            /**
             * Core KYC Engine
             * Controla o fluxo de ecrãs, acesso à câmara e estado dos dados capturados.
             * Escrito com abstrações sólidas, pronto para integração em React/Next.js mais tarde.
             */
            const KYCApp = {
                stream: null,
                data: {
                    faceFront: null,
                    faceRight: null,
                    faceLeft: null,
                    biFront: null,
                    biBack: null
                },
                livenessStep: 1,
                biStep: 1, // 1 = Frente, 2 = Verso
                timer: null,

                // --- Utilitários de UI ---
                switchView(viewId) {
                    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
                    document.getElementById(viewId).classList.add('active');
                },
                
                msg(id, text, color = "var(--primary)") {
                    const el = document.getElementById(id);
                    if(el) { el.textContent = text; el.style.color = color; }
                },

                // --- Motor de Câmara ---
                async attachCamera(videoElementId, facingMode) {
                    this.stopCamera();
                    const video = document.getElementById(videoElementId);
                    try {
                        const s = await navigator.mediaDevices.getUserMedia({ 
                            video: { facingMode: facingMode, width: { ideal: 1280 } } 
                        });
                        this.stream = s;
                        video.srcObject = s;
                        await video.play();
                        return video;
                    } catch (err) {
                        alert("Não foi possível aceder à câmara. Verifique as permissões do browser.");
                        throw err;
                    }
                },

                stopCamera() {
                    if (this.stream) {
                        this.stream.getTracks().forEach(t => t.stop());
                        this.stream = null;
                    }
                },

                takePhoto(videoEl) {
                    const canvas = document.getElementById('engine-canvas');
                    canvas.width = videoEl.videoWidth;
                    canvas.height = videoEl.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
                    return canvas.toDataURL('image/jpeg', 0.85);
                },

                flashEffect(elementId) {
                    const el = document.getElementById(elementId);
                    el.style.borderColor = "#fff";
                    el.style.backgroundColor = "rgba(255,255,255,0.3)";
                    setTimeout(() => {
                        el.style.borderColor = "rgba(255,255,255,0.5)";
                        el.style.backgroundColor = "transparent";
                    }, 150);
                },

                // --- Fluxo de Liveness (Rosto) ---
                async startLiveness() {
                    this.switchView('view-liveness-cam');
                    this.livenessStep = 1;
                    
                    try {
                        await this.attachCamera('video-liveness', 'user');
                        this.runLivenessSequence();
                    } catch (e) {
                        this.switchView('view-liveness-intro');
                    }
                },

                runLivenessSequence() {
                    const ring = document.getElementById('ring-face');
                    const video = document.getElementById('video-liveness');
                    
                    ring.classList.add('active');
                    document.getElementById('overlay-face').style.borderColor = "var(--primary)";
                    
                    const steps = [
                        { text: "1. Olhe diretamente para a câmara", prop: 'faceFront' },
                        { text: "2. Vire o rosto ligeiramente para a DIREITA", prop: 'faceRight' },
                        { text: "3. Vire o rosto ligeiramente para a ESQUERDA", prop: 'faceLeft' }
                    ];

                    const current = steps[this.livenessStep - 1];
                    this.msg('liveness-msg', current.text);
                    document.getElementById('liveness-subtitle').textContent = \`Passo \${this.livenessStep} de 3\`;

                    // Espera 3.5 segundos por cada movimento para a captura automática
                    this.timer = setTimeout(() => {
                        this.flashEffect('overlay-face');
                        this.data[current.prop] = this.takePhoto(video);
                        
                        this.livenessStep++;
                        if (this.livenessStep <= 3) {
                            this.runLivenessSequence();
                        } else {
                            ring.classList.remove('active');
                            this.stopCamera();
                            // Terminou o rosto, passa para o B.I.
                            this.switchView('view-bi-intro');
                        }
                    }, 3500);
                },

                // --- Fluxo de B.I. (Documento) ---
                async startBI() {
                    this.switchView('view-bi-cam');
                    this.biStep = 1;
                    document.getElementById('btn-capture-bi').style.display = 'flex';
                    
                    try {
                        // Tenta usar a câmara traseira ("environment")
                        await this.attachCamera('video-bi', 'environment');
                        this.setupBIUI();
                    } catch (e) {
                        // Se falhar (ex: no PC), usa a câmara frontal normal
                        try {
                            await this.attachCamera('video-bi', 'user');
                            this.setupBIUI();
                        } catch (err) {
                            this.switchView('view-bi-intro');
                        }
                    }
                },

                setupBIUI() {
                    document.getElementById('bi-title').textContent = this.biStep === 1 ? "B.I. - FRENTE" : "B.I. - VERSO";
                    this.msg('bi-msg', "Alinhe o documento e clique em Tirar Foto");
                    document.getElementById('ring-bi').classList.remove('active');
                },

                captureBI() {
                    const video = document.getElementById('video-bi');
                    this.flashEffect('overlay-bi');
                    
                    if (this.biStep === 1) {
                        this.data.biFront = this.takePhoto(video);
                        this.biStep = 2; // Passa para o verso
                        this.setupBIUI();
                    } else {
                        this.data.biBack = this.takePhoto(video);
                        this.stopCamera();
                        // Terminou o B.I., mostra as 4 fotos finais
                        this.showReview();
                    }
                },

                // --- Fluxo de Revisão Final ---
                showReview() {
                    this.switchView('view-review');
                    // Mostrar apenas 4 fotos essenciais para revisão rápida
                    document.getElementById('res-face1').src = this.data.faceFront;
                    document.getElementById('res-face2').src = this.data.faceRight;
                    document.getElementById('res-bi-front').src = this.data.biFront;
                    document.getElementById('res-bi-back').src = this.data.biBack;
                },

                restart() {
                    clearTimeout(this.timer);
                    this.stopCamera();
                    this.switchView('view-liveness-intro');
                },

                submitKYC() {
                    const btn = document.getElementById('btn-submit');
                    btn.disabled = true;
                    btn.innerHTML = "<i data-lucide='loader'></i> A processar ficheiros...";
                    lucide.createIcons();
                    
                    // Aqui seria a integração real (fetch para /api/kyc)
                    setTimeout(() => {
                        btn.innerHTML = "<i data-lucide='check'></i> KYC Submetido";
                        btn.style.background = "var(--success)";
                        this.msg('submit-msg', "Os seus documentos foram enviados para análise com sucesso. Aguarde aprovação.", "var(--success)");
                    }, 2000);
                }
            };
          </script>
        </body>
      </html>
    `);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('=============================================');
  console.log('📸 SERVIDOR DE TESTE KYC INICIADO!');
  console.log('=============================================');
  console.log('1. Abra este link no SEU PC para ver o QR Code:');
  console.log('   http://localhost:' + port);
  console.log('---------------------------------------------');
  console.log('2. O telemóvel irá aceder através de:');
  console.log('   ' + phoneUrl);
  console.log('=============================================');
  console.log('DICA: Se a câmara não abrir no telemóvel por causa');
  console.log('das regras de segurança HTTP da Apple/Google, feche');
  console.log('este script e execute o comando:');
  console.log('npx localtunnel --port ' + port);
  console.log('=============================================');
});
