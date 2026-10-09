import { images, people, jobs, projects, gear, studios } from "../assets/demo-data.js";
import { renderHeader as header, renderFooter as footer } from "../components/navigation.js";
import { jobCard, rentalCard, talentCard, workCard } from "../components/cards.js";
import { escapeHtml as safe, renderTags as tags } from "../utils/html.js";
import { currentAdmin, currentUser, getAdminCustomers, getAdminOverview, login, loginAdmin, logout, logoutAdmin, register, updateAdminPassword, updateCustomerPassword, updateCustomerProfile } from "../services/auth.js";
import { toast } from "../components/notifications.js";

const app = document.querySelector("#app");
const mobileFilterBreakpoint = window.matchMedia("(max-width: 640px)");
let activeRole = "professional";
let rentalMode = "Equipment";
let rentalCategory = "All";
let portfolioCategory = "All";
let signedInUser = null;
let signedInAdmin = null;
let adminOverview = null;
let adminCustomers = [];
let adminDashboardError = "";
let adminDashboardLoading = false;
let showSignedInNotice = false;
let showSignOutConfirm = false;
let googleSignInPending = false;

const route = () => location.hash.replace(/^#\/?/, "") || "home";
const go = (target) => { location.hash = `/${target}`; };
const button = (text, target, style = "") => `<a class="button ${style}" href="#/${target}">${text}</a>`;

function homePage() {
  return `<main class="shell">
    <section class="hero"><div class="hero-copy"><div class="eyebrow">Creative people. Real possibilities.</div><h1>Make good work.<br><em>Find your people.</em></h1><p>Discover the talent, teams, studios and tools to bring your next big idea to life.</p><div class="hero-search"><input id="home-search" aria-label="Search" placeholder="Role, skill or creative work..."><button class="button" data-action="home-search">Explore talent</button></div></div><div class="hero-mark">A more creative tomorrow, together.</div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">Meet your next collaborator</div><h2>People who make things happen.</h2></div><a class="link-more" href="#/talent">Find talent →</a></div><div class="grid four">${people.slice(0, 4).map(talentCard).join("")}</div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">The work worth doing</div><h2>Fresh opportunities.</h2></div><a class="link-more" href="#/jobs">Explore all jobs →</a></div><div class="grid two">${jobs.slice(0, 2).map(jobCard).join("")}</div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">Made by the community</div><h2>Ideas made visible.</h2></div><a class="link-more" href="#/portfolio">Explore the portfolio →</a></div><div class="grid three">${projects.slice(0, 3).map(workCard).join("")}</div></section>
    <section class="section"><div class="section-heading"><div><div class="eyebrow">Spaces and tools for creators</div><h2>Make room for a big idea.</h2></div><a class="link-more" href="#/rentals">Browse rentals →</a></div><div class="grid four">${gear.map(rentalCard).join("")}</div></section>
  </main>`;
}

function talentPage() {
  const mobile = mobileFilterBreakpoint.matches;
  return `<main class="shell"><section class="page-intro"><div class="eyebrow">Talent</div><h1>Find your next collaborator.</h1><p class="lede">Creative and technical talent for ambitious ideas. Search people by skill, specialty, or name.</p>
    <div class="searchbar"><input class="text-control" id="talent-search" placeholder="⌕ &nbsp; Role, skill or name"><button class="button" data-action="search-talent">Search talent</button></div></section>
    <div class="directory-layout"><aside class="filters ${mobile ? "collapsed" : ""}"><div class="filter-head"><span>Filters</span><div class="filter-actions"><button class="filter-toggle" type="button" data-action="toggle-filters" aria-controls="talent-filter-options" aria-expanded="${!mobile}">${mobile ? "Show filters" : "Hide filters"}</button><button class="filter-reset" type="button" data-action="reset-filters">Clear all</button></div></div><div id="talent-filter-options">
      <div class="filter-group"><span class="group-title">Profession</span>${["Design", "Development", "Creative", "Marketing", "Product", "Data & AI"].map((x) => `<label class="check-option"><input type="checkbox" class="talent-filter" value="${x}">${x}</label>`).join("")}</div>
      <div class="filter-group"><label class="group-title" for="experience">Experience</label><select class="select-control" id="experience"><option value="">Any experience</option><option>Entry level</option><option>Mid-level</option><option>Senior</option></select></div>
      <div class="filter-group"><label class="group-title" for="talent-location">Location</label><select class="select-control" id="talent-location"><option value="">Any location</option><option>Remote</option><option>London</option><option>New York</option><option>Barcelona</option></select></div>
      <div class="filter-group"><label class="group-title" for="talent-availability">Availability</label><select class="select-control" id="talent-availability"><option value="">Any availability</option><option>Available now</option><option>Not available</option></select></div></div>
    </aside><section><div class="results-top"><span id="talent-count">4 talents found</span><label>Sort by &nbsp;<select class="select-control" id="talent-sort" style="width:auto"><option value="recommended">Recommended</option><option value="rating">Top rated</option><option value="rate">Rate: low to high</option></select></label></div><div id="talent-results">${people.map((person, index) => `<article class="card talent-result" data-person-index="${index}" data-name="${safe((person.name + " " + person.role + " " + person.category + " " + person.location + " " + person.availability + " " + person.text + " " + person.skills.join(" ")).toLowerCase())}"><img src="${person.image}" alt="${safe(person.name)}"><div class="card-body"><div class="talent-meta"><div><h3>${safe(person.name)} <span class="verified">●</span></h3><span class="small-text muted">${safe(person.role)}</span></div><span class="small-text"><b class="star">★</b> ${person.rating} <span class="muted">(36)</span></span></div><p class="job-description">${safe(person.text)}</p><div class="small-text muted">⌖ ${safe(person.location)} &nbsp; · &nbsp; <strong>${safe(person.rate)}</strong> starting rate</div>${tags(person.skills)}<div style="text-align:right"><a class="button outline small" href="#/profile?person=${index}">View profile →</a></div></div></article>`).join("")}<div class="empty-state" id="talent-empty" hidden>No talent matched. Try adjusting your search or filters.</div></div></section></div>
  </main>`;
}

function jobsPage() {
  const mobile = mobileFilterBreakpoint.matches;
  return `<main class="shell"><section class="page-intro"><div class="eyebrow">Jobs</div><h1>Work worth doing.</h1><p class="lede">Join forward-thinking teams and bring your best work to life.</p><div class="searchbar"><input class="text-control" id="job-search" placeholder="⌕ &nbsp; Role, skill or company"><button class="button" data-action="search-jobs">Search jobs</button></div>
    <div class="chips">${["All", "Design", "Development", "Marketing", "Product", "Data & AI", "Creative"].map((x) => `<button class="chip ${x === "All" ? "active" : ""}" data-category="${x}">${x}</button>`).join("")}</div></section>
    <div class="jobs-layout"><aside class="filters ${mobile ? "collapsed" : ""}"><div class="filter-head"><span>Filters</span><div class="filter-actions"><button class="filter-toggle" type="button" data-action="toggle-filters" aria-controls="job-filter-options" aria-expanded="${!mobile}">${mobile ? "Show filters" : "Hide filters"}</button><button class="filter-reset" type="button" data-action="reset-job-filters">Clear all</button></div></div><div id="job-filter-options"><div class="filter-group"><label class="group-title" for="job-location">Location</label><select class="select-control" id="job-location"><option value="">Any location</option><option>Remote</option><option>New York</option><option>London</option></select></div><div class="filter-group"><span class="group-title">Work type</span>${["Full-time", "Contract", "Part-time", "Freelance"].map((x) => `<label class="check-option"><input class="job-type-filter" type="checkbox" value="${x}">${x}</label>`).join("")}</div><div class="filter-group"><label class="group-title" for="job-experience">Experience</label><select class="select-control" id="job-experience"><option value="">Any experience</option><option>Entry level</option><option>Mid level</option><option>Senior</option></select></div><div class="filter-group"><label class="group-title" for="job-salary">Minimum salary</label><select class="select-control" id="job-salary"><option value="0">Any salary</option><option value="50">$50k+</option><option value="100">$100k+</option></select></div></div></aside><section><div class="results-top"><span id="job-count">5 jobs found</span><label>Sort by &nbsp;<select class="select-control" id="job-sort" style="width:auto"><option value="recommended">Recommended</option><option value="recent">Most recent</option><option value="salary">Salary: high to low</option></select></label></div><div class="job-list" id="job-results">${jobs.map(jobCard).join("")}<div class="empty-state" id="job-empty" hidden>No jobs matched. Try adjusting your search or filters.</div></div></section></div>
  </main>`;
}

function portfolioPage() {
  const categories = ["All", "SMM", "Graphic Design", "Video", "Photography", "UI/UX", "Web Development", "Branding", "Content"];
  return `<main class="shell"><section class="split-hero"><div class="split-copy"><div class="eyebrow">Creative works. Real people.</div><h1>Ideas made visible.</h1><p class="lede">Discover creative work from a global community of filmmakers, designers, photographers and more.</p><div class="searchbar"><input class="text-control" id="portfolio-search" placeholder="⌕ &nbsp; Search portfolios, skills or keywords"><button class="button" data-action="search-portfolio">Search</button></div></div><img src="${images.work[1]}" alt="Creative film photography"></section>
    <div class="chips" id="portfolio-chips">${categories.map((x, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-portfolio-category="${x}">${x}</button>`).join("")}</div>
    <section class="section" style="padding-top:0"><div class="grid three" id="portfolio-results">${projects.map(workCard).join("")}</div></section>
  </main>`;
}

function rentalsPage() {
  return `<main class="shell"><section class="split-hero"><div class="split-copy"><div class="eyebrow">Equipment & spaces for creators</div><h1>Space, light and the right gear.</h1><p class="lede">Book professional equipment and studios from a trusted creative community.</p><div class="rental-tabs"><button class="${rentalMode === "Equipment" ? "active" : ""}" data-rental-mode="Equipment">Equipment</button><button class="${rentalMode === "Studios" ? "active" : ""}" data-rental-mode="Studios">Studios</button></div>  <div class="searchbar"><input class="text-control" id="rental-search" placeholder="⌕ &nbsp; City, equipment or studio"><button class="button" data-action="search-rentals">Search</button></div></div><img src="${rentalMode === "Equipment" ? images.rentals[0] : images.studios[0]}" alt="Creative production space"></section>
  <div class="chips" id="rental-categories">${(rentalMode === "Equipment" ? ["All", "Cameras", "Audio", "Lighting", "Lenses"] : ["All", "Photo studios", "Video studios", "Podcast rooms"]).map((x) => `<button class="chip ${rentalCategory === x ? "active" : ""}" data-rental-category="${x}">${x}</button>`).join("")}</div>
  <section class="section" style="padding-top:5px"><div class="section-heading"><h2 id="rental-heading">${rentalMode === "Equipment" ? "Available equipment" : "Studios near you"}</h2><div><span id="rental-count" class="small-text muted">${rentalMode === "Equipment" ? gear.length : studios.length} listings</span> &nbsp; <button class="filter-reset" data-action="reset-rentals">Clear filters</button></div></div><div class="grid ${rentalMode === "Equipment" ? "four" : "three"}" id="rental-results">${(rentalMode === "Equipment" ? gear : studios).map(rentalCard).join("")}<div class="empty-state" id="rental-empty" hidden>No listings matched. Try another category or search.</div></div></section>
  </main>`;
}

function profilePage() {
  const params = new URLSearchParams(route().split("?")[1] || "");
  const selectedPersonIndex = Number(params.get("person"));
  const previewPerson = params.has("person") && Number.isInteger(selectedPersonIndex) ? people[selectedPersonIndex] : null;
  if (!previewPerson) return ownProfilePage();
  const profileUser = previewPerson ? null : signedInUser;
  const activeSection = params.get("section") || "about";
  const profileName = safe(previewPerson?.name || profileUser?.name || "Maya Chen");
  const profileRole = safe(previewPerson?.role || (profileUser?.role
    ? profileUser.role.replace(/^\w/, (letter) => letter.toUpperCase())
    : "Brand Designer & Art Director"));
  const profileLocation = previewPerson
    ? `⌖ ${safe(previewPerson.location)}`
    : profileUser?.location ? `⌖ ${safe(profileUser.location)}` : profileUser ? "Location not added" : "⌖ Brooklyn, NY";
  const profileBio = previewPerson
    ? safe(previewPerson.text)
    : profileUser?.bio ? safe(profileUser.bio)
      : profileUser
        ? "Add a short introduction to help people understand what you do."
        : "Multidisciplinary brand designer and art director with 8+ years of experience helping creative companies build distinctive, human-centered brands. I combine strategic thinking with a refined visual approach to create work that connects and endures.";
  const profileSkills = previewPerson?.skills || (profileUser ? [] : ["Brand Strategy","Visual Identity","Art Direction","Creative Direction","Typography","Graphic Design","Photo & Video Direction","Presentation Design","Figma","Adobe Creative Suite"]);
  const profileRating = previewPerson?.rating || "4.9";
  const reviewCount = previewPerson ? 36 : profileUser ? 0 : 24;
  const profileAvailability = previewPerson?.availability || "Available for new projects";
  const profileImage = safe(profileUser?.picture || previewPerson?.image || images.talent[0]);
  const accountDetails = profileUser ? `<section class="panel"><div class="section-heading"><h3>Your account</h3><button class="button outline small" type="button" data-action="edit-profile">Edit details</button></div><div class="profile-stat"><span>Name</span><strong>${profileName}</strong></div><div class="profile-stat"><span>Email</span><strong>${safe(profileUser.email)}</strong></div><div class="profile-stat"><span>Account type</span><strong>${profileRole}</strong></div><form class="account-profile-form" hidden><label class="form-field"><span>Name</span><input name="name" required minlength="2" maxlength="80" value="${profileName}"></label><label class="form-field"><span>Location</span><input name="location" maxlength="120" value="${safe(profileUser.location || "")}" placeholder="City, country"></label><label class="form-field"><span>About you</span><textarea name="bio" maxlength="1000" rows="4" class="text-control">${safe(profileUser.bio || "")}</textarea></label><div class="account-actions"><button class="button small" type="submit">Save details</button><button class="button ghost small" type="button" data-action="cancel-profile-edit">Cancel</button></div></form></section>` : "";
  const tabs = [["about", "About"], ["skills", "Skills"], ["services", "Services"], ["experience", "Experience"], ["portfolio", "Portfolio"], ["reviews", "Reviews"]]
    .map(([id, label]) => `<a class="${activeSection === id ? "active" : ""}" href="#/profile?section=${id}${previewPerson ? `&person=${selectedPersonIndex}` : ""}" ${activeSection === id ? 'aria-current="location"' : ""}>${label}</a>`)
    .join("");
  const profileActions = profileUser
    ? `<button class="button outline" data-action="edit-profile">Edit profile</button>`
    : `<button class="button" data-action="contact">Contact</button>`;
  const quote = profileUser || previewPerson ? "" : `<p class="small-text profile-quote">“Thoughtful design can change how people feel, and that changes everything.”</p>`;
  const skills = profileSkills.length
    ? profileSkills.map((skill) => `<span class="profile-skill">${safe(skill)}</span>`).join("")
    : `<p class="small-text muted">Skills have not been added to this profile yet.</p>`;
  const services = previewPerson
    ? `<section class="panel" id="services"><h3>Services</h3><p class="small-text muted">Typical starting rate: ${safe(previewPerson.rate)}. Contact ${profileName} to discuss a project.</p></section>`
    : profileUser
      ? `<section class="panel" id="services"><h3>Services</h3><p class="small-text muted">Service details have not been added to this profile yet.</p></section>`
      : `<section class="panel" id="services"><h3>Services</h3><div class="grid three"><div><b class="small-text">Brand Identity</b><p class="small-text muted">Logos, visual systems, brand guidelines<br>From $3,000</p></div><div><b class="small-text">Creative Direction</b><p class="small-text muted">Campaigns, photoshoots, content direction<br>From $5,000</p></div><div><b class="small-text">Design Consultation</b><p class="small-text muted">1:1 strategy and portfolio reviews<br>From $150/hr</p></div></div></section>`;
  const portfolio = profileUser || previewPerson
    ? `<section class="panel" id="portfolio"><h3>Featured work</h3><p class="small-text muted">Portfolio work has not been added to this profile yet.</p></section>`
    : `<section class="panel" id="portfolio"><div class="section-heading"><h3>Featured work</h3><a class="link-more" href="#/portfolio">View all →</a></div><div class="grid four">${projects.slice(0,4).map((project) => `<img style="width:100%;height:90px;object-fit:cover;border-radius:6px" src="${project.image}" alt="${safe(project.title)}">`).join("")}</div></section>`;
  const reviews = reviewCount
    ? `Rated ${profileRating} out of 5 from ${reviewCount} client reviews.`
    : "No client reviews yet.";
  const experience = previewPerson
    ? `<section class="panel" id="experience"><h3>Experience</h3><p class="small-text muted">${previewPerson.years} years of professional experience.</p></section>`
    : profileUser
      ? `<section class="panel" id="experience"><h3>Experience</h3><p class="small-text muted">Experience details have not been added to this profile yet.</p></section>`
      : `<section class="panel" id="experience"><h3>Experience</h3><b class="small-text">Senior Brand Designer</b><p class="small-text muted">Lumen Collective · 2021 – Present</p><b class="small-text">Brand Designer</b><p class="small-text muted">Field Studio · 2018 – 2021</p></section>`;
  const profileOverview = previewPerson
    ? `<section class="panel"><h3>Specialist details</h3><div class="profile-stat"><span>Starting rate</span><strong>${safe(previewPerson.rate)}</strong></div><div class="profile-stat"><span>Availability</span><strong>${safe(profileAvailability)}</strong></div></section>`
    : profileUser
      ? `<section class="panel"><h3>Profile setup</h3><p class="small-text muted">Add your location, skills, and work samples to help people get to know you.</p><button class="button outline small" style="width:100%;margin-top:12px" data-action="edit-profile">Edit details</button></section>`
      : `<section class="panel"><h3>Profile insights</h3><div class="profile-stat"><span>Profile views</span><strong>1,284</strong></div><div class="profile-stat"><span>Search appearances</span><strong>342</strong></div><div class="profile-stat"><span>Response time</span><strong>Within a day</strong></div></section>`;
  const accountStatus = previewPerson
    ? (previewPerson.availability === "Available now" ? "Available for projects" : "Currently unavailable")
    : profileUser ? "Member profile" : "Available for new projects";
  const accountEmail = profileUser?.email ? ` · ${safe(profileUser.email)}` : "";
  const ratingSummary = reviewCount ? `<span class="star">★</span> ${profileRating} (${reviewCount} reviews)` : "No reviews yet";
  return `<main class="shell"><div class="profile-cover" style="background-image:linear-gradient(90deg,rgba(15,26,44,.82),rgba(15,26,44,.12)),url('${profileImage}')"></div><section class="profile-summary"><img class="avatar large" src="${profileImage}" alt="${profileName}"><div class="profile-name"><h2 style="font-size:25px;margin:0 0 4px">${profileName} <span class="verified">●</span></h2><div class="small-text muted">${profileRole}${accountEmail} · <span>${accountStatus}</span></div><div class="small-text muted" style="margin-top:5px">${profileLocation} &nbsp; · &nbsp; ${ratingSummary}</div></div><div class="profile-actions">${profileActions}</div></section>
    <nav class="profile-tabs" aria-label="Profile sections">${tabs}</nav>
    <div class="profile-columns"><div><section class="panel" id="about"><h3>About</h3><p class="small-text muted" style="line-height:1.8">${profileBio}</p>${quote}</section><section class="panel" id="skills"><h3>Skills</h3>${skills}</section>${services}${portfolio}<section class="panel" id="reviews"><h3>Client reviews</h3><p class="small-text muted">${reviews}</p></section></div>
    <aside>${accountDetails}${profileOverview}${experience}</aside></div>
  </main>`;
}

function accountSignInPrompt(label) {
  return `<main class="shell account-page"><section class="account-signin-card"><div class="eyebrow">Your Offscript account</div><h1>${label}</h1><p class="lede">Sign in to manage your profile and account settings.</p><a class="button" href="#/login">Log in</a><a class="button outline" href="#/register">Create an account</a></section></main>`;
}

function ownProfilePage() {
  if (!signedInUser) return accountSignInPrompt("Your profile");
  const user = signedInUser;
  const completion = [user.name, user.location, user.bio].filter(Boolean).length;
  const role = user.role === "professional" ? "Creative professional" : user.role === "employer" ? "Employer" : "Studio and equipment owner";
  const initials = user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return `<main class="shell account-page">
    <section class="account-welcome"><div><div class="eyebrow">Your Offscript workspace</div><h1>Good to see you, ${safe(user.name.split(" ")[0])}.</h1><p class="lede">Your profile is your introduction to the creative community. Keep it current and show people what you do.</p></div><a class="button outline" href="#/settings">Account settings</a></section>
    <section class="account-profile-hero"><div class="account-avatar">${user.picture ? `<img src="${safe(user.picture)}" alt="">` : `<span>${safe(initials)}</span>`}</div><div class="account-identity"><span class="account-role">${safe(role)}</span><h2>${safe(user.name)}</h2><p>${safe(user.location || "Add your location to help people find you")}</p><span class="account-email">${safe(user.email)}</span></div><a class="button" href="#/settings?section=profile-settings">Edit profile</a></section>
    <div class="account-content-grid"><section class="account-main-column">
      <article class="account-card"><div class="account-card-heading"><div><div class="eyebrow">Public profile</div><h2>About you</h2></div><a class="account-inline-link" href="#/settings?section=profile-settings">Edit profile</a></div><p class="account-bio">${safe(user.bio || "Add a short introduction to tell people what you do and what kinds of projects you enjoy.")}</p></article>
      <article class="account-card"><div class="account-card-heading"><div><div class="eyebrow">Your activity</div><h2>Get started on Offscript</h2></div></div><div class="account-shortcuts">
        <a class="account-shortcut" href="${user.role === "professional" ? "#/jobs" : "#/talent"}"><span class="shortcut-icon">↗</span><strong>${user.role === "professional" ? "Explore opportunities" : "Discover talent"}</strong><span>${user.role === "professional" ? "Find roles that match your skills." : "Meet creative specialists for your next project."}</span></a>
        <a class="account-shortcut" href="#/portfolio"><span class="shortcut-icon">▧</span><strong>Explore the portfolio</strong><span>See creative work from the community.</span></a>
        <a class="account-shortcut" href="#/rentals"><span class="shortcut-icon">⌂</span><strong>Browse resources</strong><span>Find equipment and studio spaces.</span></a>
      </div></article>
    </section><aside class="account-side-column"><article class="account-card profile-progress-card"><div class="eyebrow">Profile checklist</div><h2>${completion} of 3 details added</h2><div class="profile-progress" role="progressbar" aria-label="Profile completion" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${completion}"><span style="width:${Math.round(completion / 3 * 100)}%"></span></div><ul class="profile-checklist"><li class="complete"><span>✓</span> Name added</li><li class="${user.location ? "complete" : ""}"><span>${user.location ? "✓" : "○"}</span> Add your location</li><li class="${user.bio ? "complete" : ""}"><span>${user.bio ? "✓" : "○"}</span> Write an introduction</li></ul><a class="button small" href="#/settings?section=profile-settings">Complete your profile</a></article><article class="account-card account-details-card"><div class="eyebrow">Account details</div><div class="account-detail-row"><span>Email</span><strong>${safe(user.email)}</strong></div><div class="account-detail-row"><span>Account type</span><strong>${safe(role)}</strong></div><div class="account-detail-row"><span>Member since</span><strong>${new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong></div><a class="account-inline-link" href="#/settings">Manage account settings</a></article></aside></div>
  </main>`;
}

function settingsPage() {
  if (!signedInUser) return accountSignInPrompt("Account settings");
  const user = signedInUser;
  return `<main class="shell account-page settings-page">
    <div class="settings-heading"><div><div class="eyebrow">Your account</div><h1>Settings</h1><p class="lede">Update your profile information and keep your account secure.</p></div><a class="button outline" href="#/profile">Back to profile</a></div>
    <nav class="settings-nav" aria-label="Settings sections"><a class="${new URLSearchParams(route().split("?")[1] || "").get("section") !== "security-settings" ? "active" : ""}" href="#/settings?section=profile-settings">Profile details</a><a class="${new URLSearchParams(route().split("?")[1] || "").get("section") === "security-settings" ? "active" : ""}" href="#/settings?section=security-settings">Security</a></nav>
    <section class="settings-card" id="profile-settings"><div class="settings-card-copy"><div class="eyebrow">Public profile</div><h2>Personal information</h2><p>This information helps people understand who you are. Your email address is not publicly displayed.</p></div><form class="settings-profile-form">
      <label class="form-field"><span>Full name</span><input name="name" type="text" required minlength="2" maxlength="80" autocomplete="name" value="${safe(user.name)}"></label>
      <label class="form-field"><span>Email address</span><input type="email" value="${safe(user.email)}" readonly aria-describedby="email-help"><small id="email-help">Email address changes are not available here.</small></label>
      <label class="form-field"><span>Location</span><input name="location" type="text" maxlength="120" autocomplete="address-level2" value="${safe(user.location || "")}" placeholder="City, country"></label>
      <label class="form-field"><span>About you</span><textarea name="bio" maxlength="1000" rows="5" class="text-control" placeholder="Share what you do, what you're great at, and the work you're looking for.">${safe(user.bio || "")}</textarea><small>Up to 1,000 characters</small></label>
      <div class="settings-form-actions"><button class="button" type="submit">Save changes</button><span class="settings-form-status" role="status"></span></div>
    </form></section>
    <section class="settings-card" id="security-settings"><div class="settings-card-copy"><div class="eyebrow">Security</div><h2>Change password</h2><p>Use a unique password you do not use for other sites. Changing it signs out your other active sessions.</p></div><form class="settings-password-form">
      <label class="form-field"><span>Current password</span><div class="password-control"><input name="currentPassword" type="password" required autocomplete="current-password"><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></label>
      <label class="form-field"><span>New password</span><div class="password-control"><input name="newPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password" aria-describedby="password-help"><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div><small id="password-help">Use at least 8 characters.</small></label>
      <label class="form-field"><span>Confirm new password</span><input name="confirmPassword" type="password" required minlength="8" maxlength="128" autocomplete="new-password"></label>
      <p class="settings-error" role="alert" hidden></p><div class="settings-form-actions"><button class="button" type="submit">Update password</button></div>
    </form></section>
  </main>`;
}

function loginPage() {
  return `<main class="shell"><div class="auth-wrap"><section class="auth-card"><div class="auth-art"><a class="brand" href="#/home">Offscript</a><p class="auth-art-copy">A marketplace for creative talent and forward-thinking companies.</p><div class="auth-art-bottom">A more creative<br>tomorrow together.</div></div><form class="auth-form" data-form="login"><a class="brand" href="#/home">Offscript</a><h1>Welcome back</h1><p class="lede">Log in to your Offscript account.</p><label class="form-field"><span>Email address</span><input name="email" type="email" required autocomplete="email" placeholder="you@company.com"></label><label class="form-field"><span>Password</span><div class="password-control"><input name="password" type="password" required autocomplete="current-password" placeholder="••••••••••"><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></label><div class="form-row"><label><input type="checkbox" name="remember" checked> Remember me</label><span class="muted">Password resets are not available yet.</span></div><button class="button auth-submit" type="submit">Log in</button><div class="divider">or continue with</div><a class="google-button" href="/api/auth/google">🌐 &nbsp; Continue with Google</a><div class="auth-footer">New to Offscript? <a href="#/register">Create account</a></div><div class="auth-footer">Platform administrator? <a href="#/admin">Admin sign in</a></div></form></section></div></main>`;
}

function registerPage() {
  return `<main class="shell"><div class="auth-wrap"><section class="auth-card"><div class="auth-art"><a class="brand" href="#/home">Offscript</a><p class="auth-art-copy">Creative talent meets great opportunities.</p><div class="auth-art-bottom">Creative people<br>brighter opportunities.</div></div><form class="auth-form" data-form="register"><a class="brand" href="#/home">Offscript</a><h1>What are you looking for?</h1><p class="lede">Tell us a bit about yourself to get started.</p><div class="role-grid">
    <div class="role-card ${activeRole === "professional" ? "selected" : ""}" data-role="professional"><i class="role-dot"></i><strong>I'm a Professional</strong><span>Showcase your work, find opportunities, and build your career.</span></div>
    <div class="role-card ${activeRole === "employer" ? "selected" : ""}" data-role="employer"><i class="role-dot"></i><strong>I'm an Employer</strong><span>Find and hire exceptional talent for your projects.</span></div>
    <div class="role-card ${activeRole === "owner" ? "selected" : ""}" data-role="owner"><i class="role-dot"></i><strong>I'm a Studio / Gear Owner</strong><span>List spaces and equipment for creative people.</span></div>
  </div><label class="form-field"><span>Full name</span><input name="name" type="text" required autocomplete="name" placeholder="Alex Rivera"></label><label class="form-field"><span>Email address</span><input name="email" type="email" required autocomplete="email" placeholder="you@company.com"></label><label class="form-field"><span>Password</span><div class="password-control"><input name="password" type="password" required minlength="8" autocomplete="new-password" placeholder="At least 8 characters"><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></label><button class="button auth-submit" type="submit">Create account</button><div class="divider">or continue with</div><a class="google-button" href="/api/auth/google">🌐 &nbsp; Continue with Google</a><div class="auth-footer">Already have an account? <a href="#/login">Log in</a></div></form></section></div></main>`;
}

function jobDetailsPage() {
  const index = Number(new URLSearchParams(location.hash.split("?")[1] || "").get("job")) || 3;
  const job = jobs[index] || jobs[3];
  return `<main class="shell"><div class="job-detail"><article class="detail-main"><div class="breadcrumb"><a href="#/jobs">Jobs</a> &nbsp;›&nbsp; ${safe(job.category)} &nbsp;›&nbsp; ${safe(job.title)}</div><div class="company-logo">${safe(job.logo)}</div><h1 style="font-size:36px;margin-top:17px">${safe(job.title)}</h1><div class="job-company">${safe(job.company)}</div><div class="summary-line"><span>⌖ ${safe(job.location)}</span><span>◷ ${safe(job.type)}</span><span>${safe(job.salary)}</span><span>Posted ${safe(job.posted)}</span></div><img class="detail-banner" src="${images.work[1]}" alt="Behind the scenes on a creative shoot"><h3>About the position</h3><p>${safe(job.description)} We're looking for a thoughtful collaborator who cares about craft, communicates openly, and wants to make work that matters.</p><h3>Responsibilities</h3><ul><li>Shape and deliver high-quality work in collaboration with creative, brand, and product teams.</li><li>Bring fresh perspectives and thoughtful ideas to every stage of the process.</li><li>Present your work clearly and contribute to a supportive team culture.</li><li>Help evolve our creative toolkit, standards, and workflows.</li></ul><h3>Requirements</h3><ul><li>5+ years of relevant professional experience.</li><li>Strong portfolio showcasing a range of thoughtful work.</li><li>Excellent communication and collaboration skills.</li><li>A curious mind and a detail-oriented approach.</li></ul><h3>Benefits</h3><p>Competitive salary, flexible work policy, professional development budget, generous paid time off, and a creative, supportive team culture.</p></article>
    <aside class="detail-aside"><h3>Job summary</h3><div class="summary-item"><span>Company</span><strong>${safe(job.company)}</strong></div><div class="summary-item"><span>Location</span><strong>${safe(job.location)}</strong></div><div class="summary-item"><span>Employment type</span><strong>${safe(job.type)}</strong></div><div class="summary-item"><span>Salary</span><strong>${safe(job.salary)}</strong></div><div class="summary-item"><span>Posted</span><strong>${safe(job.posted)}</strong></div><button class="button" data-action="apply">Apply now</button><button class="button outline" data-action="heart">Save job</button></aside></div></main>`;
}

function adminPage() {
  if (!signedInAdmin) {
    return `<main class="shell admin-shell"><section class="admin-login-card"><div class="eyebrow">Restricted access</div><h1>Administrator sign in.</h1><p class="lede">Manage Offscript customer accounts and platform activity.</p><form class="admin-login-form" data-admin-form="login"><label class="form-field"><span>Username</span><input name="username" required autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Admin username"></label><label class="form-field"><span>Password</span><div class="password-control"><input name="password" type="password" required autocomplete="current-password" placeholder="Enter admin password"><button class="password-toggle" type="button" data-action="toggle-password" aria-label="Show password" aria-pressed="false">Show</button></div></label><p class="admin-error" role="alert" hidden></p><button class="button auth-submit" type="submit">Sign in to admin</button></form><a class="admin-back-link" href="#/home">Back to Offscript</a></section></main>`;
  }
  if (adminDashboardLoading) {
    return `<main class="shell admin-shell"><section class="admin-panel"><div class="eyebrow">Administrator</div><h1>Platform overview</h1><p class="lede">Loading customer accounts...</p></section></main>`;
  }
  if (adminDashboardError) {
    return `<main class="shell admin-shell"><section class="admin-panel"><div class="eyebrow">Administrator</div><h1>Platform overview</h1><p class="lede">${safe(adminDashboardError)}</p><button class="button" type="button" data-action="reload-admin">Try again</button></section></main>`;
  }
  const overview = adminOverview || { customers: 0, professionals: 0, employers: 0, owners: 0 };
  return `<main class="shell admin-shell"><div class="admin-heading"><div><div class="eyebrow">Administrator dashboard</div><h1>Platform overview</h1><p class="lede">Manage customer visibility and protect your platform.</p></div><button class="button outline" type="button" data-action="reload-admin">Refresh data</button></div><section class="admin-stats" aria-label="Customer account statistics">${[["Total customers", overview.customers], ["Professionals", overview.professionals], ["Employers", overview.employers], ["Studio and gear owners", overview.owners]].map(([label, value]) => `<article class="admin-stat"><span>${label}</span><strong>${value}</strong></article>`).join("")}</section><section class="admin-panel"><div class="admin-panel-heading"><div><div class="eyebrow">Customer accounts</div><h2>Registered customers</h2></div><label class="admin-search-label" for="admin-customer-search">Search accounts</label><input id="admin-customer-search" class="text-control admin-search" type="search" placeholder="Name, email, role or location"></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Account type</th><th>Location</th><th>Joined</th></tr></thead><tbody id="admin-customer-rows">${adminCustomers.map((customer) => `<tr data-admin-customer="${safe(`${customer.name} ${customer.email} ${customer.role} ${customer.location}`.toLowerCase())}"><td>${safe(customer.name)}</td><td>${safe(customer.email)}</td><td>${safe(customer.role)}</td><td>${safe(customer.location || "Not provided")}</td><td>${safe(new Date(customer.createdAt).toLocaleDateString())}</td></tr>`).join("")}</tbody></table><p class="admin-empty" id="admin-customer-empty" ${adminCustomers.length ? "hidden" : ""}>No customer accounts have been created yet.</p><p class="admin-empty" id="admin-customer-no-results" hidden>No customer accounts match your search.</p></div></section><section class="admin-panel admin-password-panel"><div><div class="eyebrow">Account security</div><h2>Change admin password</h2><p class="muted">Choose at least 12 characters. Other admin sessions will be signed out.</p></div><form class="admin-password-form" data-admin-form="password"><label class="form-field"><span>Current password</span><input name="currentPassword" type="password" required autocomplete="current-password"></label><label class="form-field"><span>New password</span><input name="newPassword" type="password" minlength="12" required autocomplete="new-password" placeholder="At least 12 characters"></label><label class="form-field"><span>Confirm new password</span><input name="confirmPassword" type="password" minlength="12" required autocomplete="new-password"></label><p class="admin-error" role="alert" hidden></p><button class="button" type="submit">Update password</button></form></section></main>`;
}

function notFoundPage() { return `<main class="shell"><div class="empty-state"><h2>You're off script.</h2><p>That page isn't here, but there's plenty to discover.</p><a class="button" href="#/home">Back to home</a></div></main>`; }

function render() {
  const current = route().split("?")[0];
  const pages = { home: homePage, talent: talentPage, jobs: jobsPage, portfolio: portfolioPage, rentals: rentalsPage, profile: profilePage, settings: settingsPage, login: loginPage, register: registerPage, admin: adminPage, "job-details": jobDetailsPage };
  app.innerHTML = `${header({ current, user: signedInUser, admin: signedInAdmin, showSignedInNotice, showSignOutConfirm })}${(pages[current] || notFoundPage)()}${footer()}`;
  const section = ["profile", "settings"].includes(current) ? new URLSearchParams(route().split("?")[1] || "").get("section") : null;
  if (section) {
    requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start"
    }));
  } else {
    window.scrollTo(0, 0);
  }
}

async function establishSession(form) {
  const submit = form.querySelector('[type="submit"]');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  const fields = new FormData(form);
  try {
    signedInUser = form.dataset.form === "register"
      ? await register({
        name: fields.get("name"),
        email: fields.get("email"),
        password: fields.get("password"),
        role: activeRole,
        remember: fields.has("remember")
      })
      : await login({
        email: fields.get("email"),
        password: fields.get("password"),
        remember: fields.has("remember")
      });
  } catch (error) {
    toast(error.message || "We could not sign you in. Please try again.");
    return;
  } finally {
    if (submit) submit.disabled = false;
  }
  showSignOutConfirm = false;
  showSignedInNotice = true;
  if (route().split("?")[0] === "home") {
    render();
    bindEvents();
  } else {
    go("home");
  }
}

async function finishSignOut() {
  try {
    if (signedInAdmin) await logoutAdmin();
    else await logout();
  } catch (error) {
    toast(error.message || "We could not sign you out. Please try again.");
    return;
  }
  signedInUser = null;
  signedInAdmin = null;
  adminOverview = null;
  adminCustomers = [];
  showSignOutConfirm = false;
  showSignedInNotice = false;
  render();
  bindEvents();
  toast("You have been signed out.");
}

function showAdminFormError(form, message) {
  const error = form.querySelector(".admin-error");
  if (!error) return;
  error.textContent = message;
  error.hidden = false;
}

async function establishAdminSession(form) {
  const submit = form.querySelector('[type="submit"]');
  if (submit?.disabled) return;
  if (submit) submit.disabled = true;
  const fields = new FormData(form);
  const error = form.querySelector(".admin-error");
  if (error) error.hidden = true;
  try {
    signedInAdmin = await loginAdmin({
      username: fields.get("username"),
      password: fields.get("password")
    });
    await loadAdminDashboard();
  } catch (requestError) {
    showAdminFormError(form, requestError.message || "Admin sign in could not be completed.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

async function loadAdminDashboard() {
  if (!signedInAdmin || adminDashboardLoading) return;
  adminDashboardLoading = true;
  adminDashboardError = "";
  if (route().split("?")[0] === "admin") {
    render();
    bindEvents();
  }
  try {
    [adminOverview, adminCustomers] = await Promise.all([getAdminOverview(), getAdminCustomers()]);
  } catch (error) {
    adminDashboardError = error.message || "We could not load the admin dashboard.";
    if (/sign in with an admin account/i.test(adminDashboardError)) signedInAdmin = null;
  } finally {
    adminDashboardLoading = false;
    if (route().split("?")[0] === "admin") {
      render();
      bindEvents();
    }
  }
}

function filterAdminCustomers() {
  const query = document.querySelector("#admin-customer-search")?.value.trim().toLowerCase() || "";
  const rows = [...document.querySelectorAll("[data-admin-customer]")];
  let visible = 0;
  rows.forEach((row) => {
    const shown = row.dataset.adminCustomer.includes(query);
    row.hidden = !shown;
    if (shown) visible++;
  });
  const empty = document.querySelector("#admin-customer-empty");
  const noResults = document.querySelector("#admin-customer-no-results");
  if (empty) empty.hidden = rows.length > 0;
  if (noResults) noResults.hidden = rows.length === 0 || visible > 0;
}

async function changeAdminPassword(form) {
  const submit = form.querySelector('[type="submit"]');
  if (submit?.disabled) return;
  const fields = new FormData(form);
  const newPassword = String(fields.get("newPassword") || "");
  const confirmPassword = String(fields.get("confirmPassword") || "");
  const error = form.querySelector(".admin-error");
  if (error) error.hidden = true;
  if (newPassword !== confirmPassword) {
    showAdminFormError(form, "The new passwords do not match.");
    return;
  }
  if (submit) submit.disabled = true;
  try {
    const message = await updateAdminPassword({
      currentPassword: fields.get("currentPassword"),
      newPassword
    });
    form.reset();
    toast(message);
  } catch (requestError) {
    showAdminFormError(form, requestError.message || "We could not update your password.");
  } finally {
    if (submit) submit.disabled = false;
  }
}

function filterTalent() {
  const query = document.querySelector("#talent-search")?.value.trim().toLowerCase() || "";
  const selected = [...document.querySelectorAll(".talent-filter:checked")].map((x) => x.value.toLowerCase());
  const experience = document.querySelector("#experience")?.value || "";
  const location = document.querySelector("#talent-location")?.value.toLowerCase() || "";
  const availability = document.querySelector("#talent-availability")?.value || "";
  const sort = document.querySelector("#talent-sort")?.value || "recommended";
  const cards = [...document.querySelectorAll(".talent-result")];
  let visible = 0;
  cards.forEach((card) => {
    const person = people[Number(card.dataset.personIndex)];
    const text = card.dataset.name || "";
    const shown = text.includes(query)
      && (!selected.length || selected.some((term) => text.includes(term)))
      && (!experience || person.experience === experience)
      && (!location || person.location.toLowerCase().includes(location))
      && (!availability || person.availability === availability);
    card.hidden = !shown;
    if (shown) visible++;
  });
  const rate = (person) => Number.parseInt(person.rate.replace(/\D/g, ""), 10);
  const sorted = cards.sort((a, b) => {
    const first = people[Number(a.dataset.personIndex)];
    const second = people[Number(b.dataset.personIndex)];
    if (sort === "rating") return Number(second.rating) - Number(first.rating);
    if (sort === "rate") return rate(first) - rate(second);
    return Number(a.dataset.personIndex) - Number(b.dataset.personIndex);
  });
  const results = document.querySelector("#talent-results");
  sorted.forEach((card) => results?.append(card));
  const count = document.querySelector("#talent-count");
  if (count) count.textContent = `${visible} ${visible === 1 ? "talent" : "talents"} found`;
  const empty = document.querySelector("#talent-empty");
  if (empty) empty.hidden = visible > 0;
}

function filterJobs(category = document.querySelector(".chip.active")?.dataset.category || "All") {
  const query = document.querySelector("#job-search")?.value.trim().toLowerCase() || "";
  const types = [...document.querySelectorAll(".job-type-filter:checked")].map((x) => x.value);
  const location = document.querySelector("#job-location")?.value.toLowerCase() || "";
  const experience = document.querySelector("#job-experience")?.value || "";
  const minimumSalary = Number(document.querySelector("#job-salary")?.value || 0);
  const sort = document.querySelector("#job-sort")?.value || "recommended";
  const cards = [...document.querySelectorAll("#job-results .job-row")];
  let visible = 0;
  cards.forEach((card) => {
    const job = jobs[Number(card.dataset.jobIndex)];
    const shown = (category === "All" || job.category === category)
      && (!query || `${job.title} ${job.company} ${job.location} ${job.type} ${job.category} ${job.description} ${job.tags.join(" ")}`.toLowerCase().includes(query))
      && (!types.length || types.includes(job.type))
      && (!location || job.location.toLowerCase().includes(location))
      && (!experience || job.experience === experience)
      && job.salaryMin >= minimumSalary;
    card.hidden = !shown;
    if (shown) visible++;
  });
  cards.sort((a, b) => {
    const first = jobs[Number(a.dataset.jobIndex)];
    const second = jobs[Number(b.dataset.jobIndex)];
    if (sort === "salary") return second.salaryMin - first.salaryMin;
    if (sort === "recent") {
      const ageInDays = (posted) => posted.includes("week") ? Number.parseInt(posted, 10) * 7 : Number.parseInt(posted, 10);
      return ageInDays(first.posted) - ageInDays(second.posted);
    }
    return jobs.indexOf(first) - jobs.indexOf(second);
  }).forEach((card) => document.querySelector("#job-results")?.append(card));
  const count = document.querySelector("#job-count");
  if (count) count.textContent = `${visible} ${visible === 1 ? "job" : "jobs"} found`;
  const empty = document.querySelector("#job-empty");
  if (empty) empty.hidden = visible > 0;
}

function filterPortfolio() {
  const query = document.querySelector("#portfolio-search")?.value.trim().toLowerCase() || "";
  const filtered = projects.filter((project) =>
    (portfolioCategory === "All" || project.category === portfolioCategory)
    && (!query || `${project.title} ${project.by} ${project.type} ${project.category}`.toLowerCase().includes(query))
  );
  const results = document.querySelector("#portfolio-results");
  if (results) results.innerHTML = filtered.map(workCard).join("") || `<div class="empty-state">No projects matched. Try another category or search.</div>`;
  bindActionsOnly();
}

function filterRentals() {
  const listings = rentalMode === "Equipment" ? gear : studios;
  const query = document.querySelector("#rental-search")?.value.trim().toLowerCase() || "";
  const filtered = listings.filter((listing) =>
    (rentalCategory === "All" || listing.category === rentalCategory)
    && (!query || `${listing.name} ${listing.type} ${listing.location} ${listing.category}`.toLowerCase().includes(query))
  );
  const results = document.querySelector("#rental-results");
  if (results) results.innerHTML = filtered.map(rentalCard).join("") || `<div class="empty-state">No listings matched. Try another category or search.</div>`;
  const count = document.querySelector("#rental-count");
  if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`;
  const heading = document.querySelector("#rental-heading");
  if (heading) heading.textContent = rentalCategory === "All" ? (rentalMode === "Equipment" ? "Available equipment" : "Studios near you") : rentalCategory;
  bindActionsOnly();
}

const searchHistoryKey = "offscript.recent-searches.v1";
const recentSearches = {};
const searchContexts = {
  "global-search": "global",
  "home-search": "home",
  "talent-search": "talent",
  "job-search": "jobs",
  "portfolio-search": "portfolio",
  "rental-search": "rentals"
};

function readSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryKey) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return recentSearches;
  }
}

function saveSearch(context, query, destination = context) {
  const cleaned = query.trim();
  if (!cleaned) return;
  const history = readSearchHistory();
  const previous = Array.isArray(history[context]) ? history[context].filter((item) => typeof item === "string") : [];
  history[context] = [cleaned, ...previous.filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 6);
  if (context === "home") {
    history.homeDestinations = { ...(history.homeDestinations || {}), [cleaned.toLowerCase()]: destination };
  }
  if (context === "global") {
    history.globalDestinations = { ...(history.globalDestinations || {}), [cleaned.toLowerCase()]: destination };
  }
  recentSearches[context] = history[context];
  try {
    localStorage.setItem(searchHistoryKey, JSON.stringify(history));
  } catch {
    recentSearches[context] = history[context];
  }
}

function suggestionsFor(context, query) {
  const value = query.trim().toLowerCase();
  const toSuggestion = (label, detail, search = label, destination = context) => ({ label, detail, search, destination });
  let candidates = [];

  if (context === "talent" || context === "home" || context === "global") {
    candidates.push(...people.map((person) => toSuggestion(person.name, `${person.role} · ${person.location}`, person.name, "talent")));
    candidates.push(...people.map((person) => toSuggestion(person.role, `${person.name} · ${person.category}`, person.role, "talent")));
    candidates.push(...people.flatMap((person) => person.skills.map((skill) => toSuggestion(skill, `Skill · ${person.role}`, skill, "talent"))));
    candidates.push(...["Design", "Development", "Creative", "Marketing", "Product", "Data & AI"].map((category) => toSuggestion(category, "Talent category", category, "talent")));
  }
  if (context === "jobs" || context === "home" || context === "global") {
    candidates.push(...jobs.map((job) => toSuggestion(job.title, `${job.company} · ${job.location}`, job.title, "jobs")));
    candidates.push(...jobs.map((job) => toSuggestion(job.category, "Job category", job.category, "jobs")));
  }
  if (context === "portfolio" || context === "home" || context === "global") {
    candidates.push(...projects.map((project) => toSuggestion(project.title, `${project.by} · ${project.type}`, project.title, "portfolio")));
    candidates.push(...projects.map((project) => toSuggestion(project.category, "Portfolio category", project.category, "portfolio")));
  }
  if (context === "rentals" || context === "home" || context === "global") {
    const listings = [...gear, ...studios];
    candidates.push(...listings.map((listing) => toSuggestion(listing.name, `${listing.type} · ${listing.location}`, listing.name, "rentals")));
    candidates.push(...[...new Set(listings.map((listing) => listing.category))].map((category) => toSuggestion(category, "Rental category", category, "rentals")));
  }

  const unique = [...new Map(candidates.map((item) => [`${item.destination}:${item.label.toLowerCase()}`, item])).values()];
  const history = readSearchHistory();
  const recent = context === "global"
    ? ["global", "talent", "jobs", "portfolio", "rentals", "home"].flatMap((key) => (Array.isArray(history[key]) ? history[key] : recentSearches[key] || []).filter((item) => typeof item === "string").map((item) => ({ item, key })))
    : (Array.isArray(history[context]) ? history[context] : recentSearches[context] || []).filter((item) => typeof item === "string").map((item) => ({ item, key: context }));
  const relevantRecent = value ? recent.filter(({ item }) => item.toLowerCase().includes(value)) : recent;
  const recentSuggestions = [...new Map(relevantRecent.map(({ item, key }) => {
    const destination = key === "home" ? history.homeDestinations?.[item.toLowerCase()] || "talent" : key === "global" ? history.globalDestinations?.[item.toLowerCase()] || "talent" : key;
    return [item.toLowerCase(), toSuggestion(item, "Recent search", item, destination)];
  })).values()].slice(0, context === "global" ? 6 : 3);
  if (!value) return { recent: recentSuggestions, predicted: [] };
  return {
    recent: recentSuggestions,
    predicted: unique.filter((item) => item.label.toLowerCase().includes(value) || item.detail.toLowerCase().includes(value)).slice(0, 6)
  };
}

function filterSearchTarget(target) {
  if (target === "talent") filterTalent();
  if (target === "jobs") filterJobs();
  if (target === "portfolio") filterPortfolio();
  if (target === "rentals") filterRentals();
}

function performSearch(context, query, destination = context) {
  const cleaned = query.trim();
  if (!cleaned) return;
  saveSearch(context, cleaned, destination);
  if (context === "global") {
    const target = ["talent", "jobs", "portfolio", "rentals"].includes(destination) ? destination : "talent";
    saveSearch(target, cleaned);
    closeGlobalSearch();
    if (route().split("?")[0] === target) {
      const selector = { talent: "#talent-search", jobs: "#job-search", portfolio: "#portfolio-search", rentals: "#rental-search" }[target];
      const field = document.querySelector(selector);
      if (field) {
        field.value = cleaned;
        filterSearchTarget(target);
      }
    } else {
      try {
        sessionStorage.setItem("offscript.pending-search", JSON.stringify({ target, query: cleaned }));
      } catch {
        recentSearches[target] = [cleaned, ...(recentSearches[target] || []).filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 6);
      }
      go(target);
    }
    return;
  }
  if (context === "home") {
    const target = destination === "home" ? "talent" : destination;
    saveSearch(target, cleaned);
    try {
      sessionStorage.setItem("offscript.pending-search", JSON.stringify({ target, query: cleaned }));
    } catch {
      recentSearches[target] = [cleaned, ...(recentSearches[target] || []).filter((item) => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 6);
    }
    go(target);
    return;
  }
  const input = document.querySelector(`#${context === "jobs" ? "job" : context === "rentals" ? "rental" : context}-search`);
  if (input && input.value !== cleaned) input.value = cleaned;
  if (context === "talent") filterTalent();
  if (context === "jobs") filterJobs();
  if (context === "portfolio") filterPortfolio();
  if (context === "rentals") filterRentals();
}

function submitGlobalSearch() {
  const query = document.querySelector("#global-search")?.value || "";
  const { recent, predicted } = suggestionsFor("global", query);
  const destination = predicted[0]?.destination || recent[0]?.destination || "talent";
  performSearch("global", query, destination);
}

function applyPendingSearch() {
  let pending;
  try {
    pending = JSON.parse(sessionStorage.getItem("offscript.pending-search") || "null");
    sessionStorage.removeItem("offscript.pending-search");
  } catch {
    pending = null;
  }
  if (pending?.query && pending.target === route().split("?")[0]) {
    const selector = { talent: "#talent-search", jobs: "#job-search", portfolio: "#portfolio-search", rentals: "#rental-search" }[pending.target];
    const input = selector && document.querySelector(selector);
    if (input) {
      input.value = pending.query;
      filterSearchTarget(pending.target);
    }
  }
}

function attachSearchAutocomplete(input) {
  if (input.dataset.autocompleteReady) return;
  input.dataset.autocompleteReady = "true";
  const context = searchContexts[input.id];
  const wrapper = input.closest(".searchbar, .hero-search");
  if (!wrapper || !context) return;
  wrapper.classList.add("searchbox");
  const popup = document.createElement("div");
  popup.className = "search-suggestions";
  popup.id = `${input.id}-suggestions`;
  popup.hidden = true;
  popup.setAttribute("role", "listbox");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", popup.id);
  input.setAttribute("aria-expanded", "false");
  wrapper.append(popup);
  let activeIndex = -1;

  const close = () => {
    popup.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  };
  const choose = (suggestion) => {
    input.value = suggestion.search;
    close();
    performSearch(context, suggestion.search, suggestion.destination);
  };
  const paint = () => {
    const { recent, predicted } = suggestionsFor(context, input.value);
    const groups = [];
    if (recent.length) groups.push({ title: "Recent searches", values: recent });
    if (predicted.length) groups.push({ title: input.value.trim() ? "Suggestions" : "Explore", values: predicted });
    popup.replaceChildren();
    groups.forEach((group) => {
      const heading = document.createElement("div");
      heading.className = "suggestion-heading";
      heading.textContent = group.title;
      popup.append(heading);
      group.values.forEach((suggestion) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "suggestion-option";
        option.setAttribute("role", "option");
        option.id = `${popup.id}-option-${popup.querySelectorAll('[role="option"]').length}`;
        option.dataset.search = suggestion.search;
        option.dataset.destination = suggestion.destination;
        const icon = document.createElement("span");
        icon.className = "suggestion-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = group.title === "Recent searches" ? "↺" : "⌕";
        const content = document.createElement("span");
        content.className = "suggestion-copy";
        const label = document.createElement("strong");
        label.textContent = suggestion.label;
        const detail = document.createElement("small");
        detail.textContent = suggestion.detail;
        content.append(label, detail);
        option.append(icon, content);
        option.addEventListener("mousedown", (event) => event.preventDefault());
        option.addEventListener("click", () => choose(suggestion));
        popup.append(option);
      });
    });
    const clear = recent.length ? document.createElement("button") : null;
    if (clear) {
      clear.type = "button";
      clear.className = "suggestion-clear";
      clear.textContent = "Clear recent searches";
      clear.addEventListener("mousedown", (event) => event.preventDefault());
      clear.addEventListener("click", () => {
        const history = readSearchHistory();
        if (context === "global") {
          for (const key of ["global", "talent", "jobs", "portfolio", "rentals", "home"]) delete history[key];
          for (const key of ["global", "talent", "jobs", "portfolio", "rentals", "home"]) delete recentSearches[key];
        } else {
          delete history[context];
          delete recentSearches[context];
        }
        try {
          localStorage.setItem(searchHistoryKey, JSON.stringify(history));
        } catch {
          delete recentSearches[context];
        }
        paint();
      });
      popup.append(clear);
    }
    popup.hidden = groups.length === 0;
    popup.classList.remove("above");
    if (!popup.hidden) {
      const inputRect = input.getBoundingClientRect();
      const popupRect = popup.getBoundingClientRect();
      const spaceBelow = window.innerHeight - inputRect.bottom;
      if (popupRect.height + 12 > spaceBelow && inputRect.top > spaceBelow) {
        popup.classList.add("above");
      }
    }
    input.setAttribute("aria-expanded", String(!popup.hidden));
    activeIndex = -1;
  };

  input.addEventListener("focus", paint);
  input.addEventListener("input", paint);
  input.addEventListener("keydown", (event) => {
    const options = [...popup.querySelectorAll('[role="option"]')];
    if (event.key === "ArrowDown" && options.length) {
      event.preventDefault();
      activeIndex = (activeIndex + 1) % options.length;
    } else if (event.key === "ArrowUp" && options.length) {
      event.preventDefault();
      activeIndex = (activeIndex - 1 + options.length) % options.length;
    } else if (event.key === "Escape") {
      close();
      return;
    } else if (event.key === "Enter") {
      event.preventDefault();
      const active = options[activeIndex];
      if (active) choose({ search: active.dataset.search, destination: active.dataset.destination });
      else if (context === "global") submitGlobalSearch();
      else performSearch(context, input.value);
      close();
      return;
    } else {
      return;
    }
    options.forEach((option, index) => {
      option.classList.toggle("active", index === activeIndex);
      option.setAttribute("aria-selected", String(index === activeIndex));
    });
    const active = options[activeIndex];
    if (active) input.setAttribute("aria-activedescendant", active.id);
  });
  input.addEventListener("blur", () => setTimeout(close, 120));
}

function closeGlobalSearch() {
  const overlay = document.querySelector("#global-search-overlay");
  if (!overlay || overlay.hidden) return;
  overlay.hidden = true;
  document.body.classList.remove("search-open");
  document.querySelector('[data-action="focus-search"]')?.focus();
}

function openGlobalSearch() {
  const overlay = document.querySelector("#global-search-overlay");
  const input = document.querySelector("#global-search");
  if (!overlay || !input) return;
  overlay.hidden = false;
  document.body.classList.add("search-open");
  input.value = "";
  input.focus();
  input.dispatchEvent(new Event("focus"));
}

function bindEvents() {
  document.querySelectorAll("[data-role]").forEach((node) => node.addEventListener("click", () => {
    activeRole = node.dataset.role;
    document.querySelectorAll("[data-role]").forEach((item) => item.classList.toggle("selected", item === node));
  }));
  document.querySelectorAll(".page-intro .chips [data-category]").forEach((node) => node.addEventListener("click", () => {
    document.querySelectorAll(".page-intro .chips [data-category]").forEach((chip) => chip.classList.toggle("active", chip === node));
    if (document.querySelector("#job-results")) filterJobs(node.dataset.category);
  }));
  document.querySelectorAll("[data-portfolio-category]").forEach((node) => node.addEventListener("click", () => {
    portfolioCategory = node.dataset.portfolioCategory;
    document.querySelectorAll("[data-portfolio-category]").forEach((chip) => chip.classList.toggle("active", chip === node));
    filterPortfolio();
  }));
  document.querySelectorAll("[data-rental-category]").forEach((node) => node.addEventListener("click", () => {
    rentalCategory = node.dataset.rentalCategory;
    document.querySelectorAll("[data-rental-category]").forEach((chip) => chip.classList.toggle("active", chip === node));
    filterRentals();
  }));
  document.querySelectorAll("[data-rental-mode]").forEach((node) => node.addEventListener("click", () => {
    rentalMode = node.dataset.rentalMode;
    rentalCategory = "All";
    render();
    bindEvents();
  }));
  document.querySelectorAll('[data-action="toggle-filters"]').forEach((node) => {
    node.addEventListener("click", () => {
      const filters = node.closest(".filters");
      if (!filters) return;
      const collapsed = filters.classList.toggle("collapsed");
      node.setAttribute("aria-expanded", String(!collapsed));
      node.textContent = collapsed ? "Show filters" : "Hide filters";
    });
  });
  document.querySelectorAll(".talent-filter, #experience, #talent-location, #talent-availability, #talent-sort").forEach((node) => node.addEventListener("change", filterTalent));
  document.querySelectorAll(".job-type-filter, #job-location, #job-experience, #job-salary, #job-sort").forEach((node) => node.addEventListener("change", () => filterJobs()));
  document.querySelector("#talent-search")?.addEventListener("input", filterTalent);
  document.querySelector("#job-search")?.addEventListener("input", () => filterJobs());
  document.querySelector("#portfolio-search")?.addEventListener("input", filterPortfolio);
  document.querySelector("#rental-search")?.addEventListener("input", filterRentals);
  document.querySelectorAll("[data-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    establishSession(form);
  }));
  document.querySelectorAll("[data-admin-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (form.dataset.adminForm === "login") establishAdminSession(form);
    if (form.dataset.adminForm === "password") changeAdminPassword(form);
  }));
  document.querySelector("#admin-customer-search")?.addEventListener("input", filterAdminCustomers);
  bindActionsOnly();
}

function searchPortfolio() {
  filterPortfolio();
}

function bindActionsOnly() {
  document.querySelectorAll('[data-action="toggle-password"]').forEach((toggle) => {
    if (toggle.dataset.bound) return;
    toggle.dataset.bound = "true";
    toggle.addEventListener("click", () => {
      const input = toggle.parentElement?.querySelector("input");
      if (!input) return;
      const showing = input.type === "password";
      input.type = showing ? "text" : "password";
      toggle.textContent = showing ? "Hide" : "Show";
      toggle.setAttribute("aria-label", showing ? "Hide password" : "Show password");
      toggle.setAttribute("aria-pressed", String(showing));
    });
  });
  document.querySelector('[data-action="sign-out"]')?.addEventListener("click", () => {
    showSignOutConfirm = true;
    render();
    bindEvents();
    document.querySelector('[data-action="cancel-sign-out"]')?.focus();
  });
  document.querySelector('[data-action="cancel-sign-out"]')?.addEventListener("click", () => {
    showSignOutConfirm = false;
    render();
    bindEvents();
    document.querySelector('[data-action="sign-out"]')?.focus();
  });
  document.querySelector('[data-action="confirm-sign-out"]')?.addEventListener("click", finishSignOut);
  document.querySelector('[data-action="reload-admin"]')?.addEventListener("click", loadAdminDashboard);
  document.querySelector('[data-action="dismiss-signed-in"]')?.addEventListener("click", () => {
    showSignedInNotice = false;
    render();
    bindEvents();
  });
  document.querySelector("#account-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      showSignedInNotice = false;
      render();
      bindEvents();
    }
  });
  document.querySelector("#sign-out-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      showSignOutConfirm = false;
      render();
      bindEvents();
    }
  });
  document.querySelectorAll('[data-action="edit-profile"]').forEach((node) => {
    node.addEventListener("click", () => {
      if (!signedInUser) {
        toast("Sign in to edit your account details.");
        return;
      }
      const form = document.querySelector(".account-profile-form");
      if (!form) {
        toast("Open your profile to edit your account details.");
        return;
      }
      form.hidden = false;
      form.querySelector("input")?.focus();
    });
  });
  document.querySelector('[data-action="cancel-profile-edit"]')?.addEventListener("click", () => {
    const form = document.querySelector(".account-profile-form");
    if (form) form.hidden = true;
  });
  document.querySelector(".account-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const fields = new FormData(form);
    try {
      signedInUser = await updateCustomerProfile({
        name: fields.get("name"),
        location: fields.get("location"),
        bio: fields.get("bio")
      });
      render();
      bindEvents();
      toast("Your account details have been saved.");
    } catch (error) {
      toast(error.message || "We could not save your account details.");
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelector(".settings-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    const fields = new FormData(form);
    const status = form.querySelector(".settings-form-status");
    if (status) status.textContent = "";
    try {
      signedInUser = await updateCustomerProfile({
        name: fields.get("name"),
        location: fields.get("location"),
        bio: fields.get("bio")
      });
      render();
      bindEvents();
      toast("Your profile details have been saved.");
    } catch (error) {
      if (status) status.textContent = error.message || "We could not save your profile details.";
      else toast(error.message || "We could not save your profile details.");
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelector(".settings-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    const fields = new FormData(form);
    const newPassword = String(fields.get("newPassword") || "");
    const errorMessage = form.querySelector(".settings-error");
    if (errorMessage) errorMessage.hidden = true;
    if (newPassword !== fields.get("confirmPassword")) {
      if (errorMessage) {
        errorMessage.textContent = "The new passwords do not match.";
        errorMessage.hidden = false;
      }
      return;
    }
    submit.disabled = true;
    try {
      const message = await updateCustomerPassword({
        currentPassword: fields.get("currentPassword"),
        newPassword
      });
      form.reset();
      toast(message);
    } catch (error) {
      if (errorMessage) {
        errorMessage.textContent = error.message || "We could not update your password.";
        errorMessage.hidden = false;
      }
    } finally {
      submit.disabled = false;
    }
  });
  document.querySelectorAll('[data-action="heart"]').forEach((node) => {
    if (node.dataset.bound) return;
    node.dataset.bound = "true";
    node.addEventListener("click", () => {
      node.classList.toggle("saved");
      node.firstChild.textContent = node.classList.contains("saved") ? "♥ " : "♡ ";
      toast(node.classList.contains("saved") ? "Saved to your collection." : "Removed from your collection.");
    });
  });
  document.querySelectorAll('[data-action="contact"], [data-action="apply"]').forEach((node) => {
    if (node.dataset.bound) return;
    node.dataset.bound = "true";
    node.addEventListener("click", () => {
      const action = node.dataset.action;
      if (!signedInUser) {
        toast(action === "apply" ? "Sign in to continue with your application." : "Sign in to contact this member.");
        go("login");
        return;
      }
      toast(action === "apply"
        ? "Job applications are not available in this preview yet."
        : "Direct messaging is not available in this preview yet.");
    });
  });
  document.querySelector('[data-action="menu"]')?.addEventListener("click", (event) => {
    const menuButton = event.currentTarget;
    const links = document.querySelector("#nav-links");
    if (!links) return;
    const open = links.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(open));
    menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  document.querySelectorAll("input[id$='-search']").forEach(attachSearchAutocomplete);
  document.querySelector('[data-action="focus-search"]')?.addEventListener("click", () => {
    openGlobalSearch();
  });
  document.querySelector('[data-action="close-global-search"]')?.addEventListener("click", closeGlobalSearch);
  document.querySelector('[data-action="submit-global-search"]')?.addEventListener("click", submitGlobalSearch);
  document.querySelector("#global-search-overlay")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) closeGlobalSearch();
  });
  document.querySelector('[data-action="home-search"]')?.addEventListener("click", () => performSearch("home", document.querySelector("#home-search")?.value || "", "talent"));
  document.querySelector('[data-action="search-talent"]')?.addEventListener("click", () => performSearch("talent", document.querySelector("#talent-search")?.value || ""));
  document.querySelector('[data-action="search-jobs"]')?.addEventListener("click", () => performSearch("jobs", document.querySelector("#job-search")?.value || ""));
  document.querySelector('[data-action="search-portfolio"]')?.addEventListener("click", () => performSearch("portfolio", document.querySelector("#portfolio-search")?.value || ""));
  document.querySelectorAll('[data-action="search-rentals"]').forEach((node) => node.addEventListener("click", () => performSearch("rentals", document.querySelector("#rental-search")?.value || "")));
  document.querySelector('[data-action="reset-filters"]')?.addEventListener("click", () => {
    document.querySelectorAll(".talent-filter").forEach((x) => x.checked = false);
    const search = document.querySelector("#talent-search");
    if (search) search.value = "";
    ["#experience", "#talent-location", "#talent-availability", "#talent-sort"].forEach((selector) => {
      const control = document.querySelector(selector);
      if (control) control.selectedIndex = 0;
    });
    filterTalent();
  });
  document.querySelector('[data-action="reset-job-filters"]')?.addEventListener("click", () => {
    document.querySelectorAll(".job-type-filter").forEach((x) => x.checked = false);
    const search = document.querySelector("#job-search");
    if (search) search.value = "";
    ["#job-location", "#job-experience", "#job-salary", "#job-sort"].forEach((selector) => {
      const control = document.querySelector(selector);
      if (control) control.selectedIndex = 0;
    });
    document.querySelectorAll(".chip[data-category]").forEach((x) => x.classList.toggle("active", x.dataset.category === "All"));
    filterJobs("All");
  });
  document.querySelector('[data-action="reset-rentals"]')?.addEventListener("click", () => {
    rentalCategory = "All";
    const search = document.querySelector("#rental-search");
    if (search) search.value = "";
    document.querySelectorAll("[data-rental-category]").forEach((chip) => chip.classList.toggle("active", chip.dataset.rentalCategory === "All"));
    filterRentals();
  });
}

window.addEventListener("hashchange", () => {
  render();
  bindEvents();
  applyPendingSearch();
  if (route().split("?")[0] === "admin" && signedInAdmin) loadAdminDashboard();
});
mobileFilterBreakpoint.addEventListener("change", (event) => {
  document.querySelectorAll(".filters").forEach((filters) => {
    filters.classList.toggle("collapsed", event.matches);
    const toggle = filters.querySelector('[data-action="toggle-filters"]');
    if (toggle) {
      toggle.setAttribute("aria-expanded", String(!event.matches));
      toggle.textContent = event.matches ? "Show filters" : "Hide filters";
    }
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeGlobalSearch();
    const menuButton = document.querySelector('[data-action="menu"]');
    if (menuButton?.getAttribute("aria-expanded") === "true") {
      document.querySelector("#nav-links")?.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open menu");
      menuButton.focus();
    }
  }
});

async function initializeSession() {
  try {
    const user = await currentUser();
    if (!user) {
      if (googleSignInPending) toast("Google sign-in could not be completed. Please try again.");
      googleSignInPending = false;
      return;
    }
    if (signedInUser) return;
    signedInUser = user;
    if (googleSignInPending) {
      googleSignInPending = false;
      showSignedInNotice = true;
    }
    render();
    bindEvents();
  } catch (error) {
    toast(error.message || "Could not connect to the account service. Please reload and try again.");
  }
}

async function initializeAdminSession() {
  try {
    signedInAdmin = await currentAdmin();
    if (signedInAdmin && route().split("?")[0] === "admin") await loadAdminDashboard();
    else if (route().split("?")[0] === "admin") {
      render();
      bindEvents();
    }
  } catch (error) {
    if (route().split("?")[0] === "admin") {
      adminDashboardError = error.message || "Could not connect to the admin service.";
      render();
      bindEvents();
    }
  }
}

function handleGoogleRedirect() {
  const [hashPath, query = ""] = location.hash.split("?");
  const params = new URLSearchParams(query);
  const error = params.get("oauth_error");
  googleSignInPending = params.get("oauth") === "google_success";
  if (!googleSignInPending && !error) return;

  history.replaceState(null, "", `${location.pathname}${location.search}${hashPath}`);
  if (error) {
    const messages = {
      google_not_configured: "Google sign-in is not set up yet. You can still use your email and password.",
      google_cancelled: "Google sign-in was cancelled.",
      google_state: "We could not verify that Google sign-in request. Please try again.",
      google_failed: "Google sign-in could not be completed. Please try again."
    };
    toast(messages[error] || messages.google_failed);
  }
}

handleGoogleRedirect();
render();
bindEvents();
applyPendingSearch();
initializeSession();
initializeAdminSession();
