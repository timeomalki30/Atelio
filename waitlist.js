// ============================================================
// ATELIO — Bannière waitlist + intégration Brevo
// ----
// Utilisation : appeler initWaitlistBanner() après le DOM ready
// Configuration : remplacer les 2 constantes ci-dessous
// ============================================================

// Configuration Brevo
const BREVO_API_KEY = "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";
const BREVO_LIST_ID = 3;

const WAITLIST_STORAGE_KEY = "atelio_waitlist_banner_closed_v1";

/**
 * Initialise la bannière waitlist : affichage conditionnel selon localStorage,
 * gestion de la fermeture, soumission du formulaire vers Brevo.
 */
function initWaitlistBanner() {
  const banner = document.getElementById("waitlistBanner");
  if (!banner) return;

  // Si l'utilisateur a déjà fermé la bannière, on ne l'affiche pas
  if (localStorage.getItem(WAITLIST_STORAGE_KEY) === "true") {
    banner.style.display = "none";
    document.body.classList.remove("has-banner");
    return;
  }
  document.body.classList.add("has-banner");

  // Bouton de fermeture
  const closeBtn = document.getElementById("waitlistClose");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      banner.style.display = "none";
      document.body.classList.remove("has-banner");
      localStorage.setItem(WAITLIST_STORAGE_KEY, "true");
    });
  }

  // Soumission du formulaire
  const form = document.getElementById("waitlistForm");
  if (form) {
    form.addEventListener("submit", handleWaitlistSubmit);
  }
}

async function handleWaitlistSubmit(e) {
  e.preventDefault();

  const firstNameInput = document.getElementById("waitlistFirstName");
  const lastNameInput = document.getElementById("waitlistLastName");
  const emailInput = document.getElementById("waitlistEmail");
  const phoneInput = document.getElementById("waitlistPhone");
  const postalInput = document.getElementById("waitlistPostal");
  const submitBtn = document.getElementById("waitlistSubmit");
  const message = document.getElementById("waitlistMessage");

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const postal = postalInput.value.trim();

  // Reset état visuel
  [firstNameInput, lastNameInput, emailInput, phoneInput, postalInput].forEach(el => el.classList.remove("invalid"));
  message.classList.remove("show", "error", "success");

  // Validation client
  if (!firstName) {
    firstNameInput.classList.add("invalid");
    showMessage(message, "error", "Prénom requis");
    firstNameInput.focus();
    return;
  }
  if (!lastName) {
    lastNameInput.classList.add("invalid");
    showMessage(message, "error", "Nom requis");
    lastNameInput.focus();
    return;
  }
  if (!email || !isValidEmail(email)) {
    emailInput.classList.add("invalid");
    showMessage(message, "error", email ? "Email invalide" : "Email requis");
    emailInput.focus();
    return;
  }
  if (!isValidPhone(phone)) {
    phoneInput.classList.add("invalid");
    showMessage(message, "error", "Téléphone invalide (ex : 06 12 34 56 78)");
    phoneInput.focus();
    return;
  }
  if (!/^\d{5}$/.test(postal)) {
    postalInput.classList.add("invalid");
    showMessage(message, "error", "Code postal invalide (5 chiffres)");
    postalInput.focus();
    return;
  }

  const phoneE164 = normalizePhone(phone);

  // État de chargement
  submitBtn.disabled = true;
  const originalContent = submitBtn.innerHTML;
  submitBtn.innerHTML = '<span class="waitlist-spinner"></span> Inscription…';

  try {
    // Mode démo si la clé n'est pas configurée
    if (BREVO_API_KEY === "TA_CLE_ICI" || !BREVO_LIST_ID) {
      console.log("🟡 Atelio waitlist — mode démo (Brevo non configuré) :", {
        firstName, lastName, email, phone: phoneE164, postal
      });
      await new Promise(r => setTimeout(r, 700));
      showSuccess(submitBtn, message);
      return;
    }

    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          FIRSTNAME: firstName,
          LASTNAME: lastName,
          SMS: phoneE164,
          CODE_POSTAL: postal
        },
        listIds: [BREVO_LIST_ID],
        updateEnabled: true // si l'email existe déjà, met à jour ses attributs/listes
      })
    });

    if (response.ok || response.status === 204) {
      showSuccess(submitBtn, message);
      return;
    }

    // Gestion d'erreurs Brevo
    let errorMsg = "Erreur lors de l'inscription. Réessayez.";
    try {
      const errorData = await response.json();
      if (errorData.code === "duplicate_parameter") {
        // Avec updateEnabled=true ce cas est rare, mais au cas où
        errorMsg = "Email déjà inscrit — vous êtes prioritaire ✓";
        showSuccess(submitBtn, message, errorMsg);
        return;
      }
      if (errorData.code === "invalid_parameter") {
        errorMsg = "Format d'email ou de code postal invalide";
      } else if (response.status === 401) {
        errorMsg = "Erreur de configuration (clé API)";
      } else if (response.status === 429) {
        errorMsg = "Trop de demandes, réessayez dans une minute";
      }
    } catch (_) {}
    throw new Error(errorMsg);
  } catch (err) {
    console.error("Atelio waitlist error:", err);
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalContent;
    showMessage(message, "error", err.message || "Erreur réseau, réessayez.");
  }
}

function showSuccess(submitBtn, message, customText) {
  // Cache le formulaire et affiche le message de confirmation
  const form = document.getElementById("waitlistForm");
  form.style.display = "none";
  showMessage(
    message,
    "success",
    customText || "C'est noté ! On vous prévient en premier dès le lancement dans votre secteur."
  );
}

function showMessage(el, type, text) {
  el.classList.remove("error", "success");
  el.classList.add("show", type);
  const icon = type === "success"
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 13l4 4L19 7"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>';
  el.innerHTML = `${icon}<span>${text}</span>`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Valide un numéro français : accepte 0612345678, 06 12 34 56 78, 06.12.34.56.78,
 * +33612345678, etc. Retourne true si le numéro est valide.
 */
function isValidPhone(phone) {
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  return /^(0[1-9]\d{8}|\+33[1-9]\d{8})$/.test(cleaned);
}

/**
 * Normalise un numéro français au format E.164 attendu par Brevo (SMS attribute).
 * Ex : "06 12 34 56 78" → "+33612345678"
 */
function normalizePhone(phone) {
  const cleaned = phone.replace(/[\s.\-()]/g, "");
  if (cleaned.startsWith("+33")) return cleaned;
  if (cleaned.startsWith("0")) return "+33" + cleaned.slice(1);
  return cleaned;
}

// Init au DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initWaitlistBanner);
} else {
  initWaitlistBanner();
}
