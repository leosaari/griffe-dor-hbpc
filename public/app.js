// ===== LA GRIFFE D'OR — App =====

(function () {
  'use strict';

  // State
  let contactType = 'phone';
  let scoreHbpc = 0;
  let scoreMetz = 0;

  // Device ID for localStorage check
  const STORAGE_KEY = 'griffedor_played';

  function getDeviceId() {
    let id = localStorage.getItem('griffedor_device');
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      localStorage.setItem('griffedor_device', id);
    }
    return id;
  }

  // Check if already played
  if (localStorage.getItem(STORAGE_KEY)) {
    showStep('already-played');
    return;
  }

  // ===== DOM =====
  const $prenom = document.getElementById('prenom');
  const $contactPhone = document.getElementById('contact-phone');
  const $contactEmail = document.getElementById('contact-email');
  const $rulesAccept = document.getElementById('rules-accept');
  const $btnPhone = document.getElementById('btn-phone');
  const $btnEmail = document.getElementById('btn-email');
  const $btnNext = document.getElementById('btn-next-step2');
  const $btnBack = document.getElementById('btn-back-step1');
  const $btnSubmit = document.getElementById('btn-submit');
  const $btnShare = document.getElementById('btn-share');
  const $scoreHbpc = document.getElementById('score-hbpc');
  const $scoreMetz = document.getElementById('score-metz');
  const $previewHbpc = document.getElementById('preview-hbpc');
  const $previewMetz = document.getElementById('preview-metz');
  const $meilleureJoueuse = document.getElementById('meilleure-joueuse');
  const $showRules = document.getElementById('show-rules');
  const $modalRules = document.getElementById('modal-rules');
  const $closeRules = document.getElementById('close-rules');
  const $shareToast = document.getElementById('share-toast');

  // ===== STEP NAVIGATION =====
  function showStep(id) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ===== CONTACT TYPE TOGGLE =====
  $btnPhone.addEventListener('click', () => {
    contactType = 'phone';
    $btnPhone.classList.add('active');
    $btnEmail.classList.remove('active');
    $contactPhone.classList.add('active');
    $contactEmail.classList.remove('active');
    $contactPhone.focus();
  });

  $btnEmail.addEventListener('click', () => {
    contactType = 'email';
    $btnEmail.classList.add('active');
    $btnPhone.classList.remove('active');
    $contactEmail.classList.add('active');
    $contactPhone.classList.remove('active');
    $contactEmail.focus();
  });

  // ===== STEP 1 → STEP 2 =====
  $btnNext.addEventListener('click', () => {
    clearErrors();
    let valid = true;

    const prenom = $prenom.value.trim();
    if (!prenom) {
      showError('prenom', 'Le prénom est obligatoire');
      valid = false;
    }

    const contact = contactType === 'phone' ? $contactPhone.value.trim() : $contactEmail.value.trim();
    if (!contact) {
      showError('contact', 'Ce champ est obligatoire');
      valid = false;
    } else if (contactType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      showError('contact', 'Format d\'email invalide');
      valid = false;
    } else if (contactType === 'phone' && !/^[\d\s+()-]{8,20}$/.test(contact)) {
      showError('contact', 'Format de numéro invalide');
      valid = false;
    }

    if (!$rulesAccept.checked) {
      showError('rules', 'Tu dois accepter le règlement');
      valid = false;
    }

    if (valid) {
      showStep('step2');
    }
  });

  // ===== BACK BUTTON =====
  $btnBack.addEventListener('click', () => {
    showStep('step1');
  });

  // ===== SCORE STEPPERS =====
  function updateScores() {
    $scoreHbpc.textContent = scoreHbpc;
    $scoreMetz.textContent = scoreMetz;
    $previewHbpc.textContent = scoreHbpc;
    $previewMetz.textContent = scoreMetz;
  }

  // Handle stepper buttons with long-press support
  document.querySelectorAll('.stepper-btn').forEach(btn => {
    let interval = null;
    let timeout = null;

    const doAction = () => {
      const team = btn.dataset.team;
      const isPlus = btn.classList.contains('plus');

      if (team === 'hbpc') {
        if (isPlus && scoreHbpc < 50) scoreHbpc++;
        if (!isPlus && scoreHbpc > 0) scoreHbpc--;
      } else {
        if (isPlus && scoreMetz < 50) scoreMetz++;
        if (!isPlus && scoreMetz > 0) scoreMetz--;
      }
      updateScores();
    };

    const startHold = (e) => {
      e.preventDefault();
      doAction();
      btn.classList.add('holding');
      timeout = setTimeout(() => {
        interval = setInterval(doAction, 80);
      }, 400);
    };

    const stopHold = () => {
      btn.classList.remove('holding');
      clearTimeout(timeout);
      clearInterval(interval);
    };

    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', stopHold);
    btn.addEventListener('pointerleave', stopHold);
    btn.addEventListener('pointercancel', stopHold);
  });

  // ===== SUBMIT PRONOSTIC =====
  $btnSubmit.addEventListener('click', async () => {
    $btnSubmit.disabled = true;
    $btnSubmit.classList.add('loading');
    $btnSubmit.textContent = '';

    const contact = contactType === 'phone' ? $contactPhone.value.trim() : $contactEmail.value.trim();

    try {
      const res = await fetch('/api/pronostic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: $prenom.value.trim(),
          contact: contact,
          contact_type: contactType,
          score_hbpc: scoreHbpc,
          score_metz: scoreMetz,
          meilleure_joueuse: $meilleureJoueuse.value.trim() || null,
          device_id: getDeviceId()
        })
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          // Already played
          localStorage.setItem(STORAGE_KEY, '1');
          showStep('already-played');
          return;
        }
        throw new Error(data.error || 'Erreur serveur');
      }

      // Success
      localStorage.setItem(STORAGE_KEY, '1');
      showConfirmation(data.total);

    } catch (err) {
      alert(err.message || 'Erreur de connexion. Réessaie.');
      $btnSubmit.disabled = false;
      $btnSubmit.classList.remove('loading');
      $btnSubmit.textContent = 'ENVOYER MON PRONOSTIC 🦁';
    }
  });

  // ===== CONFIRMATION =====
  function showConfirmation(total) {
    document.getElementById('recap-hbpc').textContent = scoreHbpc;
    document.getElementById('recap-metz').textContent = scoreMetz;
    document.getElementById('total-count').textContent = total;

    const joueuse = $meilleureJoueuse.value.trim();
    if (joueuse) {
      document.getElementById('recap-joueuse-wrap').style.display = 'block';
      document.getElementById('recap-joueuse').textContent = joueuse;
    }

    showStep('step3');
    triggerScratchAnimation();
  }

  // ===== SCRATCH ANIMATION =====
  function triggerScratchAnimation() {
    const container = document.getElementById('scratch-anim');
    container.innerHTML = '';

    for (let i = 0; i < 5; i++) {
      const line = document.createElement('div');
      line.className = 'scratch-line';
      line.style.left = (15 + Math.random() * 70) + '%';
      line.style.top = Math.random() * 20 + '%';
      line.style.height = '0';
      line.style.animationDelay = (i * 0.1) + 's';
      line.style.transform = `rotate(${-5 + Math.random() * 10}deg)`;
      container.appendChild(line);
    }
  }

  // ===== SHARE =====
  $btnShare.addEventListener('click', async () => {
    const url = window.location.href;
    const text = `Je viens de poser ma Griffe d'Or pour HBPC vs METZ ! Fais ton pronostic :`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'LA GRIFFE D\'OR', text: text, url: url });
      } catch (e) {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        $shareToast.classList.add('show');
        setTimeout(() => $shareToast.classList.remove('show'), 2000);
      } catch (e) {
        // Fallback
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        $shareToast.classList.add('show');
        setTimeout(() => $shareToast.classList.remove('show'), 2000);
      }
    }
  });

  // ===== MODAL RULES =====
  $showRules.addEventListener('click', (e) => {
    e.preventDefault();
    $modalRules.classList.add('open');
  });

  $closeRules.addEventListener('click', () => {
    $modalRules.classList.remove('open');
  });

  $modalRules.addEventListener('click', (e) => {
    if (e.target === $modalRules) {
      $modalRules.classList.remove('open');
    }
  });

  // ===== ERROR HELPERS =====
  function showError(field, msg) {
    const $err = document.getElementById('error-' + field);
    if ($err) $err.textContent = msg;

    if (field === 'prenom') $prenom.classList.add('input-error');
    if (field === 'contact') {
      $contactPhone.classList.add('input-error');
      $contactEmail.classList.add('input-error');
    }
  }

  function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  }

  // Init — show step 1
  showStep('step1');

})();
