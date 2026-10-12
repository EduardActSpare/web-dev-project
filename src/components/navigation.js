import { escapeHtml } from "../utils/html.js";

const navigationItems = [
  ["Home", "home"],
  ["Talent", "talent"],
  ["Jobs", "jobs"],
  ["Portfolio", "portfolio"],
  ["Resources", "rentals"]
];

export function renderHeader({ current, user, admin, showSignedInNotice, showSignOutConfirm }) {
  const accountName = user?.name || admin?.username || "Your account";
  const accountAvatar = user?.picture
    ? `<img src="${escapeHtml(user.picture)}" alt="">`
    : `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.8-3.6 3.1-5.5 7-5.5s6.2 1.9 7 5.5"></path></svg>`;
  const accountMenu = admin
    ? `<div class="account-menu-identity"><strong>${escapeHtml(accountName)}</strong><span>Administrator</span></div><a role="menuitem" href="#/admin">Admin dashboard</a><button role="menuitem" type="button" data-action="sign-out">Sign out</button>`
    : user
      ? `<div class="account-menu-identity"><strong>${escapeHtml(accountName)}</strong><span>${escapeHtml(user.email || "")}</span></div><a role="menuitem" href="#/profile">My profile</a><a role="menuitem" href="#/settings">Account settings</a><button role="menuitem" type="button" data-action="sign-out">Sign out</button>`
      : `<div class="account-menu-identity"><strong>Welcome to Offscript</strong><span>Sign in to manage your profile.</span></div><a role="menuitem" href="#/login">Log in</a><a role="menuitem" href="#/register">Create an account</a><a role="menuitem" href="#/admin">Administrator sign in</a>`;
  return `<div class="shell">
    <div class="topline">
      <div class="brand-lockup"><a class="brand" href="#/home">Offscript<span>.</span></a><div class="brand-note">People × Projects × Progress<br><i>A more creative, more human way to work.</i></div></div>
      <div class="topline-note">Talent and opportunities<br>for what's next.</div>
      <div class="brand-note">Creative<br>Technology<br>People</div>
    </div>
    <nav class="nav" aria-label="Main navigation">
      <a class="nav-brand" href="#/home">Offscript</a>
      <div class="nav-links" id="nav-links">${navigationItems.map(([label, key]) => `<a class="nav-link ${current === key ? "active" : ""}" href="#/${key}">${label}</a>`).join("")}</div>
      <div class="nav-actions"><button class="icon-button global-search-trigger" aria-label="Search Offscript" title="Search Offscript" data-action="focus-search"><svg class="search-glyph" aria-hidden="true" viewBox="0 0 24 24" fill="none"><circle cx="10.8" cy="10.8" r="6.3"></circle><path d="m15.4 15.4 5 5"></path></svg><span class="search-label">Search</span></button><div class="account-menu-wrap"><button class="account-menu-trigger" type="button" aria-label="Open account menu" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu"><span class="account-menu-avatar">${accountAvatar}</span><span class="account-menu-label">Account</span><svg class="account-menu-chevron" aria-hidden="true" viewBox="0 0 16 16"><path d="m4 6 4 4 4-4"></path></svg></button><div class="account-menu" id="account-menu" role="menu" aria-label="Account menu" hidden>${accountMenu}</div></div><button class="icon-button mobile-menu" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links" data-action="menu">☰</button></div>
    </nav>
  </div>
  <div class="global-search-overlay" id="global-search-overlay" hidden>
    <section class="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby="global-search-title">
      <div class="global-search-title"><div><div class="eyebrow">Search Offscript</div><h2 id="global-search-title">What are you looking for?</h2></div><button type="button" class="global-search-close" aria-label="Close search" data-action="close-global-search">×</button></div>
      <div class="searchbar global-searchbar"><span class="global-search-icon" aria-hidden="true">⌕</span><input class="text-control" id="global-search" placeholder="Try a role, skill, job, project or rental" aria-label="Search all of Offscript"><button class="button" data-action="submit-global-search">Search</button></div>
      <p class="global-search-hint">Search people, jobs, creative work, equipment and studios. <kbd>Esc</kbd> to close</p>
    </section>
  </div>
  ${showSignedInNotice ? `<div class="account-overlay" id="account-overlay"><section class="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title"><div class="account-icon">✓</div><div class="eyebrow">You're all set</div><h2 id="account-title">You're signed in${user?.name ? `, ${escapeHtml(user.name)}` : ""}.</h2><p>Your Offscript account is ready. Explore opportunities, connect with people, and share your work.</p><div class="account-actions"><button class="button" data-action="dismiss-signed-in">Explore Offscript</button><a class="button outline" href="#/profile">View profile</a></div></section></div>` : ""}
  ${showSignOutConfirm ? `<div class="account-overlay" id="sign-out-overlay"><section class="account-dialog sign-out-dialog" role="alertdialog" aria-modal="true" aria-labelledby="sign-out-title" aria-describedby="sign-out-description"><div class="account-icon sign-out-icon">↗</div><div class="eyebrow">Account</div><h2 id="sign-out-title">Sign out of Offscript?</h2><p id="sign-out-description">Are you sure you want to sign out? You can sign back in anytime.</p><div class="account-actions"><button class="button ghost" data-action="cancel-sign-out">Stay signed in</button><button class="button" data-action="confirm-sign-out">Sign out</button></div></section></div>` : ""}`;
}

export function renderFooter() {
  return `<footer class="footer shell"><div><a class="brand" href="#/home">Offscript</a><div>Real talent. Real work.</div></div><div>Creative people. Brighter opportunities.</div><div>Talent &nbsp; / &nbsp; Jobs &nbsp; / &nbsp; Portfolio &nbsp; / &nbsp; Resources</div><a class="admin-access-link" href="#/admin">Admin sign in</a></footer>`;
}
