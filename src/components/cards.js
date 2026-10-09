import { escapeHtml, renderTags } from "../utils/html.js";

export function talentCard(person, index) {
  return `<article class="card talent-card"><img class="portrait" src="${person.image}" alt="${escapeHtml(person.name)} portrait"><div class="card-body">
    <div class="talent-meta"><div><h3>${escapeHtml(person.name)} <span class="verified">●</span></h3><div class="small-text muted">${escapeHtml(person.role)}</div></div><div class="small-text"><span class="star">★</span> ${person.rating}</div></div>
    <p class="job-description">${escapeHtml(person.text)}</p><div class="small-text muted">⌖ &nbsp;${escapeHtml(person.location)} &nbsp;·&nbsp; <strong>${escapeHtml(person.rate)}</strong></div>
    ${renderTags(person.skills.slice(0, 3))}<a class="button outline small" href="#/profile?person=${index}">View profile&nbsp; →</a>
  </div></article>`;
}

export function workCard(project) {
  return `<article class="card work-card"><img src="${project.image}" alt="${escapeHtml(project.title)} project"><div class="card-body"><div class="work-info"><div><strong class="small-text">${escapeHtml(project.title)}</strong><p>by ${escapeHtml(project.by)} · ${escapeHtml(project.type)}</p></div><button class="heart" aria-label="Like ${escapeHtml(project.title)}" data-action="heart">♡ <span>${escapeHtml(project.likes)}</span></button></div></div></article>`;
}

export function jobCard(job, index) {
  return `<article class="card job-row" data-job-index="${index}"><div class="company-logo">${escapeHtml(job.logo)}</div><div class="job-content">
    <div class="job-title-line"><div><h3><a href="#/job-details?job=${index}">${escapeHtml(job.title)}</a></h3><div class="job-company">${escapeHtml(job.company)}</div></div><button class="heart" aria-label="Save job" data-action="heart">♡</button></div>
    <p class="job-description">${escapeHtml(job.description)}</p>${renderTags(job.tags)}
    <div class="job-bottom"><div class="job-meta"><span>⌖ ${escapeHtml(job.location)}</span><span>◷ ${escapeHtml(job.type)}</span><span>Posted ${escapeHtml(job.posted)}</span><span class="salary">${escapeHtml(job.salary)}</span></div><a href="#/job-details?job=${index}" class="button small">View job</a></div>
  </div></article>`;
}

export function rentalCard(item) {
  return `<article class="card rental-card"><img class="rental-image" src="${item.image}" alt="${escapeHtml(item.name)}"><div class="card-body"><div class="talent-meta"><h3>${escapeHtml(item.name)}</h3><button class="heart" aria-label="Save listing" data-action="heart">♡</button></div><div class="small-text muted">${escapeHtml(item.type)}</div><p class="small-text muted">⌖ ${escapeHtml(item.location)}</p><div class="talent-meta"><span class="rental-price">${escapeHtml(item.price)} <span>/ day</span></span><span class="small-text"><span class="star">★</span> ${escapeHtml(item.rating)}</span></div><p class="small-text muted" style="margin:10px 0">● ${escapeHtml(item.status)}</p><button class="button ghost small" data-action="contact">View details</button></div></article>`;
}
