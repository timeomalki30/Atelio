// ============================================================
// ATELIO — Inscription artisan (offre Pionniers)
// ----
// Soumet le formulaire à la liste Brevo "Artisans pionniers".
// Configuration en haut. Tu dois créer la liste dans Brevo et y mettre l'ID.
// ============================================================

// >>> CONFIGURATION <<<
const ARTISAN_BREVO_API_KEY = "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";
const ARTISAN_BREVO_LIST_ID = 4; // ID de la liste "Artisans pionniers" — À CRÉER dans Brevo et remplacer ici
// >>> --- <<<

(function () {
  const form = document.getElementById('artisanForm');
  if (!form) return;

  form.addEventListener('submit', handleSubmit);

  async function handleSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('aSubmit');
    const message   = document.getElementById('aMessage');

    // Récupération des champs
    const data = {
      prenom:      document.getElementById('aPrenom').value.trim(),
      nom:         document.getElementById('aNom').value.trim(),
      email:       document.getElementById('aEmail').value.trim(),
      telephone:   document.getElementById('aPhone').value.trim(),
      entreprise:  document.getElementById('aEntreprise').value.trim(),
      siret:       document.getElementById('aSiret').value.trim().replace(/\s/g, ''),
      metier:      document.getElementById('aMetier').value,
      experience:  document.getElementById('aExp').value,
      codePostal:  document.getElementById('aCp').value.trim(),
      ville:       document.getElementById('aVille').value.trim(),
      rayonKm:     document.getElementById('aRayon').value,
      motivation:  document.getElementById('aMotivation').value.trim(),
      certifs:     Array.from(document.querySelectorAll('input[name="certifs"]:checked')).map(c => c.value),
    };

    // Validation
    const errors = validate(data);
    if (errors.length > 0) {
      showMessage(message, 'error', errors[0]);
      const firstErrorField = errors[0].fieldId;
      if (firstErrorField) {
        const el = document.getElementById(firstErrorField);
        el?.classList.add('invalid');
        el?.focus();
      }
      return;
    }

    // Reset visuel
    document.querySelectorAll('#artisanForm .invalid').forEach(el => el.classList.remove('invalid'));
    message.classList.remove('show');

    // Loading state
    submitBtn.disabled = true;
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="form-submit-spinner"></span> Envoi en cours…';

    try {
      const phoneE164 = normalizePhone(data.telephone);

      // Mode démo si la clé n'est pas configurée
      if (ARTISAN_BREVO_API_KEY === "TA_CLE_ICI" || !ARTISAN_BREVO_LIST_ID) {
        console.log("🟡 Atelio artisan signup — mode démo (Brevo non configuré) :", { ...data, phoneE164 });
        await new Promise(r => setTimeout(r, 900));
        showSuccess(submitBtn, message, data);
        return;
      }

      // Appel Brevo
      const response = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          "api-key": ARTISAN_BREVO_API_KEY
        },
        body: JSON.stringify({
          email: data.email,
          attributes: {
            FIRSTNAME:     data.prenom,
            LASTNAME:      data.nom,
            SMS:           phoneE164,
            ENTREPRISE:    data.entreprise,
            SIRET:         data.siret,
            METIER:        data.metier,
            EXPERIENCE:    data.experience,
            CODE_POSTAL:   data.codePostal,
            VILLE:         data.ville,
            RAYON_KM:      data.rayonKm,
            CERTIFICATIONS: data.certifs.join(', '),
            MOTIVATION:    data.motivation,
            TYPE_INSCRIPTION: 'artisan_pionnier'
          },
          listIds: [4],
          updateEnabled: true
        })
      });

      if (response.ok || response.status === 204) {
        showSuccess(submitBtn, message, data);
        return;
      }

      // Gestion erreurs
      let errMsg = "Erreur lors de l'envoi. Réessayez ou contactez-nous.";
      try {
        const errData = await response.json();
        if (errData.code === "duplicate_parameter") {
          errMsg = "Cette adresse est déjà inscrite — on vous rappelle bientôt ✓";
          showSuccess(submitBtn, message, data, errMsg);
          return;
        }
        if (errData.code === "invalid_parameter") errMsg = "Format de données invalide";
        else if (response.status === 401)        errMsg = "Configuration API à vérifier";
        else if (response.status === 429)        errMsg = "Trop de demandes, réessayez dans une minute";
      } catch (_) {}
      throw new Error(errMsg);

    } catch (err) {
      console.error("Atelio artisan signup error:", err);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalContent;
      showMessage(message, 'error', err.message || "Erreur réseau, réessayez.");
    }
  }

  // ============================================================
  // VALIDATION
  // ============================================================
  function validate(d) {
    const errors = [];
    if (!d.prenom)     errors.push({ msg: 'Prénom requis',          fieldId: 'aPrenom' });
    if (!d.nom)        errors.push({ msg: 'Nom requis',             fieldId: 'aNom' });
    if (!d.email || !isValidEmail(d.email)) errors.push({ msg: 'Email invalide', fieldId: 'aEmail' });
    if (!d.telephone || !isValidPhone(d.telephone)) errors.push({ msg: 'Téléphone invalide (ex : 06 12 34 56 78)', fieldId: 'aPhone' });
    if (!d.entreprise) errors.push({ msg: 'Nom de l\'entreprise requis', fieldId: 'aEntreprise' });
    if (!isValidSiret(d.siret)) errors.push({ msg: 'SIRET invalide (14 chiffres)', fieldId: 'aSiret' });
    if (!d.metier)     errors.push({ msg: 'Métier principal requis', fieldId: 'aMetier' });
    if (!d.experience) errors.push({ msg: 'Années d\'expérience requises', fieldId: 'aExp' });
    if (!/^\d{5}$/.test(d.codePostal)) errors.push({ msg: 'Code postal invalide (5 chiffres)', fieldId: 'aCp' });
    if (!d.ville)      errors.push({ msg: 'Ville requise',          fieldId: 'aVille' });
    if (!d.rayonKm)    errors.push({ msg: 'Rayon d\'intervention requis', fieldId: 'aRayon' });
    return errors.map(e => ({ ...e, get message() { return this.msg; } }));
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }
  function isValidPhone(phone) {
    const cleaned = phone.replace(/[\s.\-()]/g, '');
    return /^(0[1-9]\d{8}|\+33[1-9]\d{8})$/.test(cleaned);
  }
  function normalizePhone(phone) {
    const cleaned = phone.replace(/[\s.\-()]/g, '');
    if (cleaned.startsWith('+33')) return cleaned;
    if (cleaned.startsWith('0'))   return '+33' + cleaned.slice(1);
    return cleaned;
  }
  function isValidSiret(siret) {
    return /^\d{14}$/.test(siret);
  }

  // ============================================================
  // UI
  // ============================================================
  function showMessage(el, type, text) {
    el.classList.remove('error', 'success');
    el.classList.add('show', type);
    const icon = type === 'success'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';
    el.innerHTML = `${icon}<span>${text.message || text}</span>`;
  }

  function showSuccess(submitBtn, message, data, customText) {
    // Cache le formulaire et affiche un grand bloc de succès
    const form = document.getElementById('artisanForm');
    form.style.display = 'none';

    const successText = customText || `On vous rappelle sous 48 h au ${data.telephone}`;

    message.classList.remove('error');
    message.classList.add('show', 'success');
    message.innerHTML = `
      <div class="success-icon-big">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>
      </div>
      <h3 style="font-family: var(--font-head); font-weight: 800; font-size: var(--fs-2xl); color: var(--c-text); letter-spacing: -0.02em; margin-bottom: 8px;">
        ${data.prenom}, votre candidature est reçue !
      </h3>
      <p style="font-size: var(--fs-md); color: var(--c-text-soft); max-width: 50ch; margin: 0 auto 16px; line-height: 1.55;">
        ${successText}. On vérifie votre SIRET et vos certifs ensemble, et on vous met en ligne dans la foulée si tout est OK.
      </p>
      <p style="font-size: 13px; color: var(--c-text-muted); margin-bottom: 20px;">
        Pendant ce temps, vous pouvez explorer la <a href="artisan.html" style="color: var(--c-accent); font-weight: 600;">démo de votre futur tableau de bord</a>.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="artisan.html" class="btn btn-primary">Voir le tableau de bord</a>
        <a href="index.html" class="btn btn-ghost" style="background: white;">Retour à l'accueil</a>
      </div>
    `;

    // Scroll vers le message
    setTimeout(() => message.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }

  // ============================================================
  // CHAMPS auto-formatés
  // ============================================================
  document.getElementById('aSiret')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 14);
  });
  document.getElementById('aCp')?.addEventListener('input', e => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 5);
  });
})();
