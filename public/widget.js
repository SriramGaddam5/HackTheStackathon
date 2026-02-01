(function () {
  // Configuration
  const API_URL = 'https://feedback-to-code.vercel.app/api/external/feedback';
  const scriptTag = document.currentScript;
  const API_KEY = scriptTag.getAttribute('data-api-key');

  if (!API_KEY) {
    console.error('Feedback Widget: Missing data-api-key attribute');
    return;
  }

  // Styles
  const validStyles = `
    .feedback-widget-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 24px;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 30px;
      cursor: pointer;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 600;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      transition: transform 0.2s;
    }
    .feedback-widget-btn:hover {
      transform: scale(1.05);
    }
    .feedback-modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    }
    .feedback-modal-overlay.open {
      opacity: 1;
      pointer-events: all;
    }
    .feedback-modal {
      background: #fff;
      width: 400px;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      font-family: system-ui, -apple-system, sans-serif;
      transform: translateY(20px);
      transition: transform 0.3s;
    }
    .feedback-modal-overlay.open .feedback-modal {
      transform: translateY(0);
    }
    .feedback-modal h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
    }
    .feedback-textarea {
      width: 100%;
      height: 120px;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 16px;
      font-family: inherit;
      resize: vertical;
    }
    .feedback-submit-btn {
      width: 100%;
      padding: 12px;
      background: #000;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    .feedback-submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .feedback-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #666;
    }
  `;

  // Inject Styles
  const styleSheet = document.createElement("style");
  styleSheet.innerText = validStyles;
  document.head.appendChild(styleSheet);

  // Create UI Elements
  const button = document.createElement('button');
  button.className = 'feedback-widget-btn';
  button.innerText = 'Feedback';
  document.body.appendChild(button);

  const overlay = document.createElement('div');
  overlay.className = 'feedback-modal-overlay';
  overlay.innerHTML = `
    <div class="feedback-modal">
      <button class="feedback-close">&times;</button>
      <h3>Send us Feedback</h3>
      <textarea class="feedback-textarea" placeholder="Tell us what's wrong or what you'd like to see..."></textarea>
      <button class="feedback-submit-btn">Submit Feedback</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // Event Listeners
  const closeBtn = overlay.querySelector('.feedback-close');
  const submitBtn = overlay.querySelector('.feedback-submit-btn');
  const textarea = overlay.querySelector('.feedback-textarea');

  button.addEventListener('click', () => {
    overlay.classList.add('open');
  });

  closeBtn.addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });

  submitBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) return;

    submitBtn.innerText = 'Sending...';
    submitBtn.disabled = true;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify({
          content,
          meta: {
            url: window.location.href,
            userAgent: navigator.userAgent
          }
        })
      });

      if (response.ok) {
        submitBtn.innerText = 'Sent!';
        setTimeout(() => {
          overlay.classList.remove('open');
          textarea.value = '';
          submitBtn.innerText = 'Submit Feedback';
          submitBtn.disabled = false;
        }, 1000);
      } else {
        throw new Error('Failed');
      }
    } catch (error) {
      console.error(error);
      submitBtn.innerText = 'Error. Try again.';
      submitBtn.disabled = false;
    }
  });

})();
