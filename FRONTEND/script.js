// UP Police E-TA/DA Seva Portal - Client-Side RESTful API Integration

// Global Session Variables
let currentUser = null;
let token = null;
let currentCaptchaText = "";
let currentReviewClaims = []; // Store claims fetched for review
let selectedReviewClaim = null; // Store claim currently selected for modal review

// captcha characters
const CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

// Initialize page on load
window.addEventListener("DOMContentLoaded", () => {
  // Check if session exists in LocalStorage
  const savedToken = localStorage.getItem("token");
  const savedUser = localStorage.getItem("user");

  if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
    setupRoleViews();
    switchView("dashboard-view");

    // Go to default section based on role
    if (currentUser.role === "Employee") {
      switchDashboardSection("db-overview", document.querySelector(".sidebar-menu li.employee-only"));
    } else {
      switchDashboardSection("db-admin-overview", document.querySelector(".sidebar-menu li.admin-only"));
    }
  } else {
    // Show login view
    switchView("login-view");
  }

  // Generate captcha
  generateCaptcha();

  // Render lucide icons
  lucide.createIcons();
});

// -------------------------------------------------------------
// ROLE VIEWS & NAVIGATION SETUP
// -------------------------------------------------------------
function setupRoleViews() {
  if (!currentUser) return;

  // Set Profile details in Sidebar
  document.getElementById("db-profile-name").innerText = currentUser.fullname;
  document.getElementById("db-profile-rank").innerText = `${currentUser.rank} | ${currentUser.posting}`;

  // Set Profile initials
  const names = currentUser.fullname.split(" ");
  let initials = "";
  if (names.length >= 2) {
    initials = (names[0].replace(/[^A-Za-z]/g, "").charAt(0) + names[1].replace(/[^A-Za-z]/g, "").charAt(0)).toUpperCase();
  } else {
    initials = currentUser.fullname.substring(0, 2).toUpperCase();
  }
  document.getElementById("db-profile-initials").innerText = initials || "UP";
  document.getElementById("profile-avatar-letters").innerText = initials || "UP";

  // Toggle Sidebar Menu items based on role
  const employeeItems = document.querySelectorAll(".employee-only");
  const adminItems = document.querySelectorAll(".admin-only");

  if (currentUser.role === "Employee") {
    employeeItems.forEach(item => item.style.display = "flex");
    adminItems.forEach(item => item.style.display = "none");
  } else {
    employeeItems.forEach(item => item.style.display = "none");
    adminItems.forEach(item => item.style.display = "flex");
  }
}

// -------------------------------------------------------------
// CAPTCHA LOGIC (Canvas rendering)
// -------------------------------------------------------------
function generateCaptcha() {
  const canvas = document.getElementById("captcha-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let text = "";
  for (let i = 0; i < 5; i++) {
    text += CAPTCHA_CHARS.charAt(Math.floor(Math.random() * CAPTCHA_CHARS.length));
  }
  currentCaptchaText = text;

  document.getElementById("captcha-text-display").innerText = "";

  // Background
  ctx.fillStyle = "#fafbfc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Distortion lines
  const colors = ["#cbd5e1", "#94a3b8", "#10b981", "#cfa856"];
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.lineWidth = Math.random() * 2 + 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
    ctx.stroke();
  }

  // Distort background points
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
  }

  ctx.font = "bold 26px 'Outfit', sans-serif";
  ctx.textBaseline = "middle";

  const charWidth = (canvas.width - 40) / 5;
  for (let i = 0; i < text.length; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#0b2240" : "#162a45";
    ctx.save();

    const x = 20 + i * charWidth + Math.random() * 5;
    const y = canvas.height / 2 + (Math.random() * 8 - 4);

    const angle = (Math.random() * 20 - 10) * Math.PI / 180;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillText(text.charAt(i), 0, 0);

    ctx.restore();
  }
}

// -------------------------------------------------------------
// VIEW NAVIGATION & ROUTING
// -------------------------------------------------------------
function switchView(viewId) {
  const views = document.querySelectorAll(".app-view");
  views.forEach(view => view.classList.remove("active"));

  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.add("active");
  }

  if (viewId === "login-view") {
    document.getElementById("login-form").reset();
    document.getElementById("login-error-alert").style.display = "none";
    generateCaptcha();
  } else if (viewId === "register-view") {
    document.getElementById("register-form").reset();
    document.getElementById("register-error-alert").style.display = "none";
  } else if (viewId === "forgot-password-view") {
    resetForgotForm();
  }

  lucide.createIcons();
  window.scrollTo(0, 0);
}

function switchDashboardSection(sectionId, menuElement) {
  const sections = document.querySelectorAll(".dashboard-section");
  sections.forEach(sec => sec.classList.remove("active"));

  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add("active");
  }

  const menuItems = document.querySelectorAll(".sidebar-menu .menu-item");
  menuItems.forEach(item => item.classList.remove("active"));
  if (menuElement) {
    menuElement.classList.add("active");
  }

  // Section specific refreshes
  if (sectionId === "db-overview") {
    refreshOverviewDashboard();
  } else if (sectionId === "db-track-claims") {
    refreshTrackingTable();
  } else if (sectionId === "db-mis-reports") {
    renderMISCharts();
  } else if (sectionId === "db-profile") {
    loadProfileDetails();
  } else if (sectionId === "db-admin-overview") {
    refreshAdminClaimsTable();
  } else if (sectionId === "db-admin-audit") {
    refreshAdminAuditLogs();
  }

  lucide.createIcons();
  window.scrollTo(0, 0);
}

function togglePasswordVisibility(inputId, toggleBtn) {
  const input = document.getElementById(inputId);
  if (!input) return;

  if (input.type === "password") {
    input.type = "text";
    toggleBtn.innerHTML = `<i data-lucide="eye-off" style="width: 18px; height: 18px;"></i>`;
  } else {
    input.type = "password";
    toggleBtn.innerHTML = `<i data-lucide="eye" style="width: 18px; height: 18px;"></i>`;
  }
  lucide.createIcons();
}

// -------------------------------------------------------------
// LOGIN LOGIC
// -------------------------------------------------------------
async function handleLoginSubmit(event) {
  event.preventDefault();

  const userIdInput = document.getElementById("login-userid").value.trim();
  const passwordInput = document.getElementById("login-password").value;
  const captchaInput = document.getElementById("login-captcha-input").value.trim().toUpperCase();

  const errorAlert = document.getElementById("login-error-alert");
  const errorText = document.getElementById("login-error-text");

  errorAlert.style.display = "none";

  // 1. Validate Captcha
  if (captchaInput !== currentCaptchaText) {
    errorText.innerText = "Invalid Captcha. Please enter the correct code.";
    errorAlert.style.display = "flex";
    generateCaptcha();
    document.getElementById("login-captcha-input").value = "";
    return;
  }

  // 2. API Login call
  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: userIdInput, password: passwordInput })
    });

    if (!res.ok) {
      const text = await res.text();
      let errMessage = "Incorrect credentials";
      try {
        const err = JSON.parse(text);
        errMessage = err.message || errMessage;
      } catch (e) {
        errMessage = text || errMessage;
      }
      throw new Error(errMessage);
    }

    const data = await res.json();
    token = data.token;
    currentUser = data.user;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(currentUser));

    setupRoleViews();
    switchView("dashboard-view");

    if (currentUser.role === "Employee") {
      switchDashboardSection("db-overview", document.querySelector(".sidebar-menu li.employee-only"));
    } else {
      switchDashboardSection("db-admin-overview", document.querySelector(".sidebar-menu li.admin-only"));
    }
  } catch (err) {
    errorText.innerText = err.message;
    errorAlert.style.display = "flex";
    generateCaptcha();
    document.getElementById("login-captcha-input").value = "";
  }
}

// Quick demo login - bypasses captcha for testing convenience
async function demoLogin(userid) {
  const errorAlert = document.getElementById("login-error-alert");
  const errorText = document.getElementById("login-error-text");
  errorAlert.style.display = "none";

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: userid, password: "password123" })
    });

    if (!res.ok) {
      const text = await res.text();
      let errMessage = "Incorrect credentials";
      try {
        const err = JSON.parse(text);
        errMessage = err.message || errMessage;
      } catch (e) {
        errMessage = text || errMessage;
      }
      throw new Error(errMessage);
    }

    const data = await res.json();
    token = data.token;
    currentUser = data.user;

    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(currentUser));

    setupRoleViews();
    switchView("dashboard-view");

    if (currentUser.role === "Employee") {
      switchDashboardSection("db-overview", document.querySelector(".sidebar-menu li.employee-only"));
    } else {
      switchDashboardSection("db-admin-overview", document.querySelector(".sidebar-menu li.admin-only"));
    }
  } catch (err) {
    errorText.innerText = err.message;
    errorAlert.style.display = "flex";
  }
}

// -------------------------------------------------------------
// REGISTRATION LOGIC
// -------------------------------------------------------------
async function handleRegisterSubmit(event) {
  event.preventDefault();

  const fullname = document.getElementById("reg-fullname").value.trim();
  const userid = document.getElementById("reg-userid").value.trim();
  const rank = document.getElementById("reg-rank").value.trim();
  const posting = document.getElementById("reg-posting").value.trim();
  const mobile = document.getElementById("reg-mobile").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirmpassword").value;
  const role = document.getElementById("reg-role").value;

  const errorAlert = document.getElementById("register-error-alert");
  const errorText = document.getElementById("register-error-text");

  errorAlert.style.display = "none";

  if (password !== confirmPassword) {
    errorText.innerText = "Passwords do not match!";
    errorAlert.style.display = "flex";
    return;
  }

  if (userid.length < 5) {
    errorText.innerText = "User ID / PNO must be at least 5 digits.";
    errorAlert.style.display = "flex";
    return;
  }

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid, password, fullname, rank, posting, mobile, email, role })
    });

    if (!res.ok) {
      const text = await res.text(); let errMsg = "Registration failed"; try { const errObj = JSON.parse(text); errMsg = errObj.message || errMsg; } catch (e) { errMsg = text || errMsg; } throw new Error(errMsg);
    }

    alert(`Registration Successful!\nYou can now log in with User ID (PNO): ${userid}`);
    switchView("login-view");
  } catch (err) {
    errorText.innerText = err.message;
    errorAlert.style.display = "flex";
  }
}

// -------------------------------------------------------------
// FORGOT PASSWORD RECOVERY LOGIC (Simulated Client Flow)
// -------------------------------------------------------------
function handleForgotStep1(event) {
  event.preventDefault();

  const userid = document.getElementById("forgot-userid").value.trim();
  const email = document.getElementById("forgot-email").value.trim();
  const alertBox = document.getElementById("forgot-alert");
  const alertText = document.getElementById("forgot-alert-text");

  alertBox.style.display = "none";

  if (userid && email) {
    document.getElementById("forgot-form-step1").style.display = "none";
    document.getElementById("forgot-form-step2").style.display = "block";
  } else {
    alertText.innerText = "Please fill in all recovery fields.";
    alertBox.style.display = "flex";
  }
}

function handleForgotStep2(event) {
  event.preventDefault();

  const otp = document.getElementById("forgot-otp").value.trim();
  const alertBox = document.getElementById("forgot-alert");
  const alertText = document.getElementById("forgot-alert-text");

  alertBox.style.display = "none";

  if (otp !== "789012") {
    alertText.innerText = "Invalid verification code! Enter the demo OTP: 789012.";
    alertBox.style.display = "flex";
    return;
  }

  alert("Password reset simulated successfully! Please log in.");
  switchView("login-view");
}

function resetForgotForm() {
  document.getElementById("forgot-form-step1").reset();
  document.getElementById("forgot-form-step2").reset();
  document.getElementById("forgot-form-step1").style.display = "block";
  document.getElementById("forgot-form-step2").style.display = "none";
  document.getElementById("forgot-alert").style.display = "none";
}

// -------------------------------------------------------------
// LOGOUT LOGIC
// -------------------------------------------------------------
function handleLogout() {
  if (confirm("Are you sure you want to log out of the Secure TA/DA Seva Portal?")) {
    currentUser = null;
    token = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    switchView("login-view");
  }
}

// -------------------------------------------------------------
// FILE UPLOAD HANDLER (REAL UPLOADING)
// -------------------------------------------------------------
let uploadedFilePath = "";
let claimUploadInProgress = false;
let claimSubmitRequested = false;

function markClaimSubmitRequested() {
  claimSubmitRequested = true;
}

function openClaimFilePicker(event) {
  event.preventDefault();
  event.stopPropagation();

  const fileInput = document.getElementById("claim-file-input");
  if (fileInput) {
    fileInput.click();
  }
}

async function handleRealFileChange(event) {
  event.stopPropagation();
  event.preventDefault();

  const file = event.target.files[0];
  if (!file) return;

  const statusText = document.getElementById("upload-status-text");

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    statusText.innerHTML = `<span style="color:var(--danger-color);"><i data-lucide="alert-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> File too large. Max size is 5MB.</span>`;
    lucide.createIcons();
    return;
  }

  // Ensure user is logged in
  if (!token) {
    statusText.innerHTML = `<span style="color:var(--danger-color);"><i data-lucide="alert-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Please log in before uploading.</span>`;
    lucide.createIcons();
    return;
  }

  statusText.innerHTML = `<span style="color:var(--warning-color);"><i data-lucide="refresh-cw" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px; animation: spin 1.5s linear infinite;"></i> Uploading bill receipt...</span>`;
  lucide.createIcons();
  claimUploadInProgress = true;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    if (!res.ok) {
      const text = await res.text();
      let errMsg = "Failed to upload file";
      try { const errObj = JSON.parse(text); errMsg = errObj.message || errMsg; } catch (e) { errMsg = text || errMsg; }
      throw new Error(errMsg);
    }

    const data = await res.json();
    uploadedFilePath = data.filepath;
    statusText.innerHTML = `<span style="color:var(--success-color); font-weight:700;"><i data-lucide="file-check" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> ${file.name} (Uploaded &amp; Attached)</span>`;
  } catch (err) {
    statusText.innerHTML = `<span style="color:var(--danger-color);"><i data-lucide="alert-circle" style="width:16px; height:16px; display:inline-block; vertical-align:middle; margin-right:4px;"></i> Upload failed: ${err.message}</span>`;
    uploadedFilePath = "";
    // Reset the file input so user can try again
    event.target.value = "";
  } finally {
    claimUploadInProgress = false;
  }
  lucide.createIcons();
}

// -------------------------------------------------------------
// OFFICER DASHBOARD - OVERVIEW
// -------------------------------------------------------------
async function refreshOverviewDashboard() {
  if (!currentUser || !token) return;

  // Welcome Msg
  document.getElementById("db-welcome-msg").innerText = `Welcome Back, ${currentUser.fullname}!`;

  try {
    const res = await fetch(`https://e-ta-da-seva-portal.onrender.com/api/claim/user/${currentUser.userid}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Could not fetch claims history");

    const claims = await res.json();

    let totalSum = 0;
    let pendingSum = 0;
    let approvedSum = 0;
    let disbursedSum = 0;

    claims.forEach(c => {
      totalSum += c.totalClaim;
      if (c.status.startsWith("pending")) {
        pendingSum += c.totalClaim;
      }
      if (c.status === "pending_accounts") {
        approvedSum += c.totalClaim;
      }
      if (c.status === "disbursed") {
        disbursedSum += c.totalClaim;
      }
    });

    document.getElementById("stat-total-claims").innerText = "₹" + totalSum.toLocaleString("en-IN");
    document.getElementById("stat-pending-claims").innerText = "₹" + pendingSum.toLocaleString("en-IN");
    document.getElementById("stat-approved-claims").innerText = "₹" + approvedSum.toLocaleString("en-IN");
    document.getElementById("stat-disbursed-claims").innerText = "₹" + disbursedSum.toLocaleString("en-IN");

    const tbody = document.getElementById("overview-claims-tbody");
    tbody.innerHTML = "";

    if (claims.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-gray); padding: 30px;">
            No claim logs found. Click "Submit TA/DA Claim" to start.
          </td>
        </tr>
      `;
      return;
    }

    const sortedClaims = [...claims].reverse().slice(0, 5);
    sortedClaims.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--police-light-blue);">${c.id}</td>
        <td>${c.submitDate}</td>
        <td style="font-weight: 500;">${c.purpose}</td>
        <td>₹${c.ticketFare.toLocaleString("en-IN")}</td>
        <td>₹${(c.daDays * c.daRate).toLocaleString("en-IN")}</td>
        <td style="font-weight: 700; color:#111827;">₹${c.totalClaim.toLocaleString("en-IN")}</td>
        <td>
          <span class="status-badge ${mapStatusBadgeClass(c.status)}">
            <i data-lucide="${getStatusIcon(c.status)}" style="width: 13px; height: 13px; display:inline-block; vertical-align: middle;"></i>
            <span style="vertical-align: middle;">${mapStatusLabel(c.status)}</span>
          </span>
        </td>
        <td>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.75rem; height: auto;" onclick="trackSpecificClaim('${c.id}')">
            Track
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error(err);
  }

  lucide.createIcons();
}

function mapStatusBadgeClass(status) {
  if (status === "pending_so") return "pending";
  if (status === "pending_accounts") return "approved"; // approved by SO, pending accounts
  if (status === "disbursed") return "disbursed";
  if (status === "rejected") return "rejected";
  return "pending";
}

function mapStatusLabel(status) {
  if (status === "pending_so") return "Pending SO Verification";
  if (status === "pending_accounts") return "Pending Admin Approval";
  if (status === "disbursed") return "Disbursed";
  if (status === "rejected") return "Rejected";
  return status;
}

function getStatusIcon(status) {
  if (status === "disbursed") return "wallet";
  if (status === "pending_so" || status === "pending_accounts") return "clock";
  if (status === "rejected") return "alert-circle";
  return "check";
}

function trackSpecificClaim(claimId) {
  const trackMenuLi = document.querySelector(".sidebar-menu li.employee-only:nth-child(3)");
  switchDashboardSection("db-track-claims", trackMenuLi);
  showClaimTracking(claimId);
}

// -------------------------------------------------------------
// TA/DA CLAIM SUBMISSION
// -------------------------------------------------------------
function calculateClaimSums() {
  const fare = parseFloat(document.getElementById("claim-ticket-fare").value) || 0;
  const days = parseFloat(document.getElementById("claim-da-days").value) || 0;
  const daRate = parseFloat(document.getElementById("claim-da-rate").value) || 0;
  const other = parseFloat(document.getElementById("claim-other-exp").value) || 0;

  const daTotal = days * daRate;
  const grandTotal = fare + daTotal + other;

  document.getElementById("calc-fare-val").innerText = "₹" + fare.toLocaleString("en-IN");
  document.getElementById("calc-da-val").innerText = "₹" + daTotal.toLocaleString("en-IN");
  document.getElementById("calc-other-val").innerText = "₹" + other.toLocaleString("en-IN");
  document.getElementById("calc-grand-val").innerText = "₹" + grandTotal.toLocaleString("en-IN");
}

async function handleClaimSubmit(event) {
  event.preventDefault();
  event.stopPropagation();

  const isClaimSubmitButton = claimSubmitRequested || (event.submitter && event.submitter.id === "claim-submit-btn");
  claimSubmitRequested = false;

  if (claimUploadInProgress || !isClaimSubmitButton) {
    return;
  }

  if (!currentUser || !token) return;

  const journeyDateVal = document.getElementById("claim-journey-date").value;
  const dep = document.getElementById("claim-dep-station").value.trim();
  const arr = document.getElementById("claim-arr-station").value.trim();
  const travelMode = document.getElementById("claim-travel-mode").value;
  const ticketNo = document.getElementById("claim-ticket-no").value.trim();
  const distance = parseInt(document.getElementById("claim-distance").value) || 0;
  const ticketFare = parseFloat(document.getElementById("claim-ticket-fare").value) || 0;
  const purpose = document.getElementById("claim-purpose").value;
  const daDays = parseInt(document.getElementById("claim-da-days").value) || 0;
  const daRate = parseFloat(document.getElementById("claim-da-rate").value) || 0;
  const otherExp = parseFloat(document.getElementById("claim-other-exp").value) || 0;

  const totalClaim = ticketFare + (daDays * daRate) + otherExp;

  const formattedJourneyDate = formatDateString(journeyDateVal);

  const claimPayload = {
    journeyDate: formattedJourneyDate,
    depStation: dep,
    arrStation: arr,
    travelMode,
    ticketNo,
    distance,
    ticketFare,
    purpose,
    daDays,
    daRate,
    otherExp,
    totalClaim,
    attachment: uploadedFilePath
  };

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/claim/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(claimPayload)
    });

    if (!res.ok) {
      const text = await res.text(); let errMsg = "Failed to submit claim"; try { const errObj = JSON.parse(text); errMsg = errObj.message || errMsg; } catch (e) { errMsg = text || errMsg; } throw new Error(errMsg);
    }

    const data = await res.json();
    alert(`Claim Submitted Successfully!\nTracking ID: ${data.claimId}`);

    resetClaimForm();

    // Redirect to track page
    const trackMenuLi = document.querySelector(".sidebar-menu li.employee-only:nth-child(3)");
    switchDashboardSection("db-track-claims", trackMenuLi);
    showClaimTracking(data.claimId);
  } catch (err) {
    alert(err.message);
  }
}

function resetClaimForm() {
  document.getElementById("claim-submission-form").reset();
  uploadedFilePath = "";
  document.getElementById("upload-status-text").innerText = "Click to browse and upload ticket, diary log, or official duty order";
  calculateClaimSums();
}

function formatDateString(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.getDate() + " " + d.toLocaleString("en-IN", { month: "short" }) + " " + d.getFullYear();
}

// -------------------------------------------------------------
// REAL-TIME CLAIM TRACKING
// -------------------------------------------------------------
async function refreshTrackingTable() {
  if (!currentUser || !token) return;

  try {
    const res = await fetch(`https://e-ta-da-seva-portal.onrender.com/api/claim/user/${currentUser.userid}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Could not fetch claims");
    const claims = await res.json();

    const tbody = document.getElementById("tracking-claims-tbody");
    tbody.innerHTML = "";

    if (claims.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-gray); padding: 30px;">
            No claim logs found. Submit a new claim to begin tracking.
          </td>
        </tr>
      `;
      document.getElementById("stepper-details-panel").style.display = "none";
      return;
    }

    const sortedClaims = [...claims].reverse();
    sortedClaims.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--police-light-blue);">${c.id}</td>
        <td style="font-weight: 500;">${c.purpose}</td>
        <td>
          <span class="status-badge ${mapStatusBadgeClass(c.status)}">
            <i data-lucide="${getStatusIcon(c.status)}" style="width: 13px; height: 13px; display:inline-block; vertical-align: middle;"></i>
            <span style="vertical-align: middle;">${mapStatusLabel(c.status)}</span>
          </span>
        </td>
        <td style="font-weight: 700;">₹${c.totalClaim.toLocaleString("en-IN")}</td>
        <td>
          <button class="login-btn" style="padding: 6px 12px; font-size: 0.8rem; height: auto; width: auto; display:inline-flex;" onclick="showClaimTracking('${c.id}')">
            <i data-lucide="eye" style="width: 14px; height: 14px; margin-right: 2px;"></i> View Stepper
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }

  lucide.createIcons();
}

async function showClaimTracking(claimId) {
  if (!currentUser || !token) return;

  try {
    const res = await fetch(`https://e-ta-da-seva-portal.onrender.com/api/claim/user/${currentUser.userid}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const claims = await res.json();
    const claim = claims.find(c => c.id === claimId);

    if (!claim) return;

    const stepperPanel = document.getElementById("stepper-details-panel");
    stepperPanel.style.display = "block";

    document.getElementById("track-claim-id").innerText = claim.id;
    document.getElementById("track-purpose").innerText = claim.purpose;
    document.getElementById("track-total-val").innerText = "₹" + claim.totalClaim.toLocaleString("en-IN");

    const statusTxt = document.getElementById("track-status-text");
    statusTxt.innerText = mapStatusLabel(claim.status).toUpperCase();

    // Set attachment link
    const attachmentBox = document.getElementById("track-attachment-box");
    const attachmentLink = document.getElementById("track-attachment-link");

    if (claim.attachment) {
      attachmentBox.style.display = "block";
      attachmentLink.href = claim.attachment;
    } else {
      attachmentBox.style.display = "none";
    }

    // Nodes
    const node1 = document.getElementById("step-node-1");
    const node2 = document.getElementById("step-node-2");
    const node3 = document.getElementById("step-node-3");
    const node4 = document.getElementById("step-node-4");

    const icon2 = document.getElementById("step-icon-2");
    const icon3 = document.getElementById("step-icon-3");
    const icon4 = document.getElementById("step-icon-4");

    const date1 = document.getElementById("step-date-1");
    const date2 = document.getElementById("step-date-2");
    const date3 = document.getElementById("step-date-3");
    const date4 = document.getElementById("step-date-4");

    const progressFill = document.getElementById("track-step-progress-fill");

    const nodes = [node1, node2, node3, node4];
    nodes.forEach(n => n.className = "step-node");

    date1.innerText = claim.timeline.step1 || "";
    date2.innerText = claim.timeline.step2 || "Pending";
    date3.innerText = claim.timeline.step3 || "Pending";
    date4.innerText = claim.timeline.step4 || "Pending";

    icon2.innerHTML = "2";
    icon3.innerHTML = "3";
    icon4.innerHTML = "4";

    node1.classList.add("completed");

    // Update Stepper steps and progress line based on SQL workflow
    if (claim.status === "pending_so") {
      node2.classList.add("active");
      date2.innerText = "In Progress";
      progressFill.style.width = "16.6%";
      statusTxt.style.color = "var(--warning-color)";
    } else if (claim.status === "pending_accounts") {
      node2.classList.add("completed");
      icon2.innerHTML = `<i data-lucide="check" style="width: 18px; height: 18px;"></i>`;
      node3.classList.add("active");
      date2.innerText = claim.timeline.step2;
      date3.innerText = "Awaiting Release";
      progressFill.style.width = "50%";
      statusTxt.style.color = "var(--success-color)";
    } else if (claim.status === "disbursed") {
      node2.classList.add("completed");
      node3.classList.add("completed");
      node4.classList.add("completed");
      icon2.innerHTML = `<i data-lucide="check" style="width: 18px; height: 18px;"></i>`;
      icon3.innerHTML = `<i data-lucide="check" style="width: 18px; height: 18px;"></i>`;
      icon4.innerHTML = `<i data-lucide="check" style="width: 18px; height: 18px;"></i>`;
      date2.innerText = claim.timeline.step2;
      date3.innerText = claim.timeline.step3;
      date4.innerText = claim.timeline.step4;
      progressFill.style.width = "100%";
      statusTxt.style.color = "#8b5cf6"; // Purple
    } else if (claim.status === "rejected") {
      // Rejection
      node2.classList.add("completed");
      icon2.innerHTML = `<i data-lucide="alert-circle" style="width: 18px; height: 18px;"></i>`;
      progressFill.style.width = "33.3%";
      statusTxt.style.color = "var(--danger-color)";
    }

    lucide.createIcons();
    stepperPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// MIS & REPORTS
// -------------------------------------------------------------
async function renderMISCharts() {
  if (!currentUser || !token) return;

  try {
    const res = await fetch(`https://e-ta-da-seva-portal.onrender.com/api/claim/user/${currentUser.userid}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const claims = await res.json();

    const monthlySums = { "Apr": 0, "May": 0, "Jun": 0, "Jul": 0, "Aug": 0, "Sep": 0 };

    claims.forEach(c => {
      const parts = c.submitDate.split(" ");
      if (parts.length >= 2) {
        const month = parts[1];
        let key = month;
        if (month === "June") key = "Jun";
        if (month === "July") key = "Jul";
        if (monthlySums.hasOwnProperty(key)) {
          monthlySums[key] += c.totalClaim;
        }
      }
    });

    const values = Object.values(monthlySums);
    const maxVal = Math.max(...values, 5000);

    const chartBarsContainer = document.getElementById("mis-chart-bars");
    chartBarsContainer.innerHTML = "";

    Object.keys(monthlySums).forEach(month => {
      const sum = monthlySums[month];
      const percentageHeight = (sum / maxVal) * 220;

      const wrapper = document.createElement("div");
      wrapper.className = "chart-bar-wrapper";
      wrapper.innerHTML = `
        <div class="chart-bar" style="height: ${percentageHeight}px;">
          <div class="chart-bar-tooltip">₹${sum.toLocaleString("en-IN")}</div>
        </div>
        <span class="chart-bar-label">${month}</span>
      `;
      chartBarsContainer.appendChild(wrapper);
    });
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// OFFICER PROFILE SETTINGS
// -------------------------------------------------------------
async function loadProfileDetails() {
  if (!currentUser || !token) return;

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/profile", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();
    const profile = await res.json();

    document.getElementById("prof-name").value = profile.fullname;
    document.getElementById("prof-userid").value = profile.userid;
    document.getElementById("prof-rank").value = profile.rank;
    document.getElementById("prof-posting").value = profile.posting;
    document.getElementById("prof-bank-name").value = profile.bankName || "";
    document.getElementById("prof-bank-acct").value = profile.bankAcct || "";
    document.getElementById("prof-bank-ifsc").value = profile.bankIfsc || "";
    document.getElementById("prof-mobile").value = profile.mobile;

    document.getElementById("profile-success-alert").style.display = "none";
  } catch (err) {
    console.error("Failed to load profile details", err);
  }
}

async function handleProfileUpdate(event) {
  event.preventDefault();

  if (!currentUser || !token) return;

  const fullname = document.getElementById("prof-name").value.trim();
  const rank = document.getElementById("prof-rank").value.trim();
  const posting = document.getElementById("prof-posting").value.trim();
  const bankName = document.getElementById("prof-bank-name").value.trim();
  const bankAcct = document.getElementById("prof-bank-acct").value.trim();
  const bankIfsc = document.getElementById("prof-bank-ifsc").value.trim().toUpperCase();
  const mobile = document.getElementById("prof-mobile").value.trim();

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ fullname, rank, posting, bankName, bankAcct, bankIfsc, mobile })
    });

    if (!res.ok) {
      const text = await res.text(); let errMsg = "Failed to update profile"; try { const errObj = JSON.parse(text); errMsg = errObj.message || errMsg; } catch (e) { errMsg = text || errMsg; } throw new Error(errMsg);
    }

    // Update local currentUser representation
    currentUser.fullname = fullname;
    currentUser.rank = rank;
    currentUser.posting = posting;
    currentUser.bankName = bankName;
    currentUser.bankAcct = bankAcct;
    currentUser.bankIfsc = bankIfsc;
    currentUser.mobile = mobile;
    localStorage.setItem("user", JSON.stringify(currentUser));

    setupRoleViews();

    const alertBox = document.getElementById("profile-success-alert");
    alertBox.style.display = "flex";
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 4000);
  } catch (err) {
    alert(err.message);
  }
}

// -------------------------------------------------------------
// ADMIN / SO PANELS LOGIC
// -------------------------------------------------------------
function getReviewWorkflowText() {
  if (currentUser && currentUser.role === "SO") {
    return {
      title: "SO Verification Dashboard",
      desc: "Verify employee TA/DA claims and forward valid claims to Admin / Accounts for final approval.",
      filterTitle: "Filter Claims Pending SO Verification",
      tableTitle: "Claims Awaiting SO Verification",
      emptyText: "No employee claims are pending SO verification.",
      reviewButton: "Verify",
      approveButton: "Verify & Forward to Admin",
      approveSuccess: "verified and forwarded to Admin / Accounts"
    };
  }

  return {
    title: "Admin / Accounts Approval Dashboard",
    desc: "Review SO-verified TA/DA claims and complete final approval or disbursement.",
    filterTitle: "Filter Claims Pending Admin Approval",
    tableTitle: "SO-Verified Claims Awaiting Admin Approval",
    emptyText: "No SO-verified claims are pending Admin / Accounts approval.",
    reviewButton: "Approve",
    approveButton: "Approve & Disburse Funds",
    approveSuccess: "approved and disbursed"
  };
}

function applyReviewWorkflowText() {
  const text = getReviewWorkflowText();
  const title = document.getElementById("review-dashboard-title");
  const desc = document.getElementById("review-dashboard-desc");
  const filterTitle = document.getElementById("review-filter-title");
  const tableTitle = document.getElementById("review-table-title");

  if (title) title.innerText = text.title;
  if (desc) desc.innerText = text.desc;
  if (filterTitle) filterTitle.innerText = text.filterTitle;
  if (tableTitle) tableTitle.innerText = text.tableTitle;
}

async function refreshAdminClaimsTable() {
  if (!currentUser || !token) return;
  applyReviewWorkflowText();
  const workflowText = getReviewWorkflowText();

  // Gather Filters
  const posting = document.getElementById("admin-filter-posting").value.trim();
  const rank = document.getElementById("admin-filter-rank").value;
  const date = document.getElementById("admin-filter-date").value;

  // Format filter date to match stored DB format
  let formattedDate = "";
  if (date) {
    formattedDate = formatDateString(date);
  }

  // Build query
  let url = `https://e-ta-da-seva-portal.onrender.com/api/claim/pending?posting=${encodeURIComponent(posting)}&rank=${encodeURIComponent(rank)}&date=${encodeURIComponent(formattedDate)}`;

  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Could not load review claims");

    const claims = await res.json();
    currentReviewClaims = claims;

    // Update Admin Stats count
    document.getElementById("admin-stat-pending").innerText = claims.length;

    // Populate Admin Table
    const tbody = document.getElementById("admin-claims-tbody");
    tbody.innerHTML = "";

    if (claims.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: var(--text-gray); padding: 30px;">
            ${workflowText.emptyText}
          </td>
        </tr>
      `;
      return;
    }

    claims.forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--police-light-blue);">${c.id}</td>
        <td style="font-weight: 600;">${c.officerName}</td>
        <td>${c.officerRank} (${c.officerPosting})</td>
        <td>${c.purpose}</td>
        <td style="font-weight: 700;">₹${c.totalClaim.toLocaleString("en-IN")}</td>
        <td>${c.journeyDate}</td>
        <td>
          <button class="login-btn" style="padding: 6px 12px; font-size: 0.8rem; height: auto; width: auto;" onclick="openReviewModal('${c.id}')">
            ${workflowText.reviewButton}
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Also load audit log overview stats
    loadAdminStatsSums();
  } catch (err) {
    console.error(err);
  }

  lucide.createIcons();
}

async function loadAdminStatsSums() {
  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/audit-logs", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return;
    const logs = await res.json();

    const totalAudits = logs.length;
    document.getElementById("admin-stat-total").innerText = totalAudits;

    // Disbursed amount estimation from logs (search 'disbursed funds for claim')
    let totalDisbursed = 0;
    logs.forEach(l => {
      if (l.action === "ACCOUNTS_DISBURSE") {
        // extract claim amount or just sum disbursements
        // details template: "Accounts approved and disbursed funds for claim TA-XXXXX..."
        // To be accurate, we could query historical db but since we are using audit log, this is a clean audit indicator.
        // Let's make it show the count of disbursements or fetch all claims if we want exact math,
        // but since total claims audited is displayed, this is a great audit KPI.
        // Let's fetch historical statistics or show a nice summary!
      }
    });

    // Let's actually count disbursements from audit logs or just show the count. Let's make it show a formatted number of audit actions.
  } catch (err) {
    console.error(err);
  }
}

function resetAdminFilters() {
  document.getElementById("admin-filter-posting").value = "";
  document.getElementById("admin-filter-rank").value = "";
  document.getElementById("admin-filter-date").value = "";
  refreshAdminClaimsTable();
}

// -------------------------------------------------------------
// CLAIM REVIEW MODAL
// -------------------------------------------------------------
function openReviewModal(claimId) {
  selectedReviewClaim = currentReviewClaims.find(c => c.id === claimId);
  if (!selectedReviewClaim) return;

  document.getElementById("review-claim-id").innerText = selectedReviewClaim.id;
  document.getElementById("review-officer-name").innerText = selectedReviewClaim.officerName;
  document.getElementById("review-officer-pno").innerText = selectedReviewClaim.userid;
  document.getElementById("review-officer-rank").innerText = selectedReviewClaim.officerRank;
  document.getElementById("review-officer-posting").innerText = selectedReviewClaim.officerPosting;

  document.getElementById("review-journey-date").innerText = selectedReviewClaim.journeyDate;
  document.getElementById("review-route").innerText = `${selectedReviewClaim.depStation} → ${selectedReviewClaim.arrStation}`;
  document.getElementById("review-travel-mode").innerText = selectedReviewClaim.travelMode;
  document.getElementById("review-ticket-no").innerText = selectedReviewClaim.ticketNo;
  document.getElementById("review-distance").innerText = `${selectedReviewClaim.distance} km`;
  document.getElementById("review-fare").innerText = selectedReviewClaim.ticketFare.toLocaleString("en-IN");

  document.getElementById("review-da-days").innerText = selectedReviewClaim.daDays;
  document.getElementById("review-da-rate").innerText = selectedReviewClaim.daRate.toLocaleString("en-IN");
  document.getElementById("review-da-total").innerText = (selectedReviewClaim.daDays * selectedReviewClaim.daRate).toLocaleString("en-IN");
  document.getElementById("review-other").innerText = selectedReviewClaim.otherExp.toLocaleString("en-IN");
  document.getElementById("review-grand-total").innerText = selectedReviewClaim.totalClaim.toLocaleString("en-IN");
  document.getElementById("review-purpose").innerText = selectedReviewClaim.purpose;

  // Receipts Link
  const attachmentBox = document.getElementById("review-attachment-box");
  attachmentBox.innerHTML = "";

  if (selectedReviewClaim.attachment) {
    attachmentBox.style.display = "flex";
    attachmentBox.innerHTML = `
      <i data-lucide="file-check"></i>
      <a href="${selectedReviewClaim.attachment}" target="_blank" style="color:var(--police-light-blue); text-decoration:underline; font-weight:700;">
        View Uploaded Bill Receipt File
      </a>
    `;
  } else {
    attachmentBox.style.display = "flex";
    attachmentBox.innerHTML = `
      <i data-lucide="file-warning" style="color:var(--danger-color);"></i>
      <span style="color:var(--text-gray);">No supporting documents attached to this claim.</span>
    `;
  }

  // Set action button labels based on role
  const btnApprove = document.getElementById("review-btn-approve");
  btnApprove.innerText = getReviewWorkflowText().approveButton;

  document.getElementById("review-remarks").value = "";

  // Display Modal Overlay
  document.getElementById("review-modal").style.display = "flex";
  lucide.createIcons();
}

function closeReviewModal() {
  document.getElementById("review-modal").style.display = "none";
  selectedReviewClaim = null;
}

async function submitReviewAction(action) {
  if (!selectedReviewClaim || !token) return;

  const remarks = document.getElementById("review-remarks").value.trim();

  // Rejection requires remarks!
  if (action === "reject" && !remarks) {
    alert("Compliance Warning:\nYou must provide audit remarks explaining the reason for rejecting this claim request.");
    return;
  }

  try {
    const res = await fetch(`https://e-ta-da-seva-portal.onrender.com/api/claim/${selectedReviewClaim.id}/approve`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({ action, remarks })
    });

    if (!res.ok) {
      const text = await res.text(); let errMsg = "Failed to process review"; try { const errObj = JSON.parse(text); errMsg = errObj.message || errMsg; } catch (e) { errMsg = text || errMsg; } throw new Error(errMsg);
    }

    const actionText = action === 'approve' ? getReviewWorkflowText().approveSuccess : 'rejected';
    alert(`Claim ${selectedReviewClaim.id} has been successfully ${actionText}.`);
    closeReviewModal();
    refreshAdminClaimsTable();
  } catch (err) {
    alert(err.message);
  }
}

// -------------------------------------------------------------
// SYSTEM AUDIT LOGS DISPLAY
// -------------------------------------------------------------
async function refreshAdminAuditLogs() {
  if (!currentUser || !token) return;

  try {
    const res = await fetch("https://e-ta-da-seva-portal.onrender.com/api/audit-logs", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Could not load audit logs");

    const logs = await res.json();

    const tbody = document.getElementById("admin-audit-tbody");
    tbody.innerHTML = "";

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: var(--text-gray); padding: 30px;">
            No audit log records found in database.
          </td>
        </tr>
      `;
      return;
    }

    logs.forEach(l => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--text-gray); font-family: monospace;">#${l.id}</td>
        <td>${l.timestamp}</td>
        <td style="font-weight: 600; color: var(--police-light-blue);">${l.userid}</td>
        <td><span class="status-badge ${mapAuditBadgeClass(l.action)}">${l.action}</span></td>
        <td style="font-size: 0.85rem; font-weight: 500;">${l.details}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

function mapAuditBadgeClass(action) {
  if (action === "LOGIN") return "disbursed"; // Purple/blue
  if (action === "REGISTER") return "approved"; // Green
  if (action.includes("APPROVE") || action.includes("DISBURSE")) return "approved";
  if (action.includes("REJECT")) return "rejected";
  return "pending";
}
