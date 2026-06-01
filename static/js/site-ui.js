const header = document.querySelector("[data-header]");
const onScrollHeader = () => {
  header?.classList.toggle("is-scrolled", window.scrollY > 32);
};
onScrollHeader();
window.addEventListener("scroll", onScrollHeader, { passive: true });

const sideRail = document.querySelector(".side-rail");
const sideRailStart = document.querySelector(".about-panel");
const SIDE_RAIL_FIXED_TOP = 82;
let sideRailHideTimer = 0;
let sideRailLastScrollY = window.scrollY;
const hideSideRail = () => {
  if (!sideRail?.classList.contains("is-visible") || sideRail.classList.contains("is-hiding")) return;
  sideRail.classList.add("is-hiding");
  sideRailHideTimer = window.setTimeout(() => {
    sideRail.classList.remove("is-visible", "is-hiding");
  }, 680);
};
const syncSideRailVisibility = () => {
  if (!sideRail || !sideRailStart) return;
  const scrollingUp = window.scrollY < sideRailLastScrollY;
  sideRailLastScrollY = window.scrollY;
  const start = sideRailStart.getBoundingClientRect().top;
  const reachedContent = start <= SIDE_RAIL_FIXED_TOP;
  if (!sideRail.classList.contains("is-docked")) {
    sideRail.style.setProperty("--side-rail-left", `${sideRail.getBoundingClientRect().left}px`);
  }
  sideRail.classList.toggle("is-docked", reachedContent);
  const contentEnteringViewport = start < window.innerHeight - 24;
  const halfBarOutsideViewport = start >= window.innerHeight - sideRail.offsetHeight * 0.5;
  if (scrollingUp && halfBarOutsideViewport) {
    hideSideRail();
    return;
  }
  if (reachedContent || contentEnteringViewport) {
    window.clearTimeout(sideRailHideTimer);
    sideRail.classList.remove("is-hiding");
    sideRail.classList.add("is-visible");
  }
};
syncSideRailVisibility();
window.addEventListener("scroll", syncSideRailVisibility, { passive: true });
window.addEventListener("resize", syncSideRailVisibility);

const navToggle = document.querySelector("[data-nav-toggle]");
const nav = document.querySelector("[data-nav]");
navToggle?.addEventListener("click", () => {
  const open = !nav?.classList.contains("is-open");
  nav?.classList.toggle("is-open", open);
  navToggle.setAttribute("aria-expanded", String(open));
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.remove("is-hiding");
        entry.target.classList.add("is-visible");
        return;
      }
      if (!entry.target.classList.contains("is-visible")) return;
      entry.target.classList.add("is-hiding");
      entry.target.classList.remove("is-visible");
      window.setTimeout(() => entry.target.classList.remove("is-hiding"), 620);
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);
document.querySelectorAll("[data-reveal]").forEach((element) => revealObserver.observe(element));

const hero = document.querySelector("[data-hero]");
const heroArt = document.querySelector(".hero-art");
window.addEventListener(
  "scroll",
  () => {
    if (!hero || !heroArt) return;
    const progress = Math.min(window.scrollY / Math.max(hero.offsetHeight, 1), 1);
    heroArt.style.transform = `translate3d(0, ${progress * 34}px, 0) scale(${1.05 + progress * 0.04})`;
  },
  { passive: true }
);

document.querySelectorAll(".portrait-gallery [data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    document.querySelectorAll(".portrait-gallery [data-filter]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelectorAll(".portrait-gallery [data-member-card]").forEach((card) => {
      const visible = filter === "all" || card.dataset.generation === filter;
      card.classList.toggle("is-filtered", !visible);
      card.hidden = !visible;
    });
  });
});
