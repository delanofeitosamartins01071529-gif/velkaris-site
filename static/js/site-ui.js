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

document.querySelectorAll("[data-flash-message]").forEach((message) => {
  message.addEventListener("animationend", () => message.remove(), { once: true });
});

nav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  });
});

const revealHideTimers = new WeakMap();
const REVEAL_ANIMATION_MS = 640;
const showReveal = (element) => {
  window.clearTimeout(revealHideTimers.get(element));
  element.classList.remove("is-hiding");
  element.classList.add("is-visible");
};
const hideReveal = (element) => {
  if (!element.classList.contains("is-visible") || element.classList.contains("is-hiding")) return;
  element.classList.add("is-hiding");
  element.classList.remove("is-visible");
  const timer = window.setTimeout(() => element.classList.remove("is-hiding"), REVEAL_ANIMATION_MS);
  revealHideTimers.set(element, timer);
};

const revealElements = [...document.querySelectorAll("[data-reveal]")];
let revealFrame = 0;
let revealLastScrollY = window.scrollY;
const syncReveals = () => {
  revealFrame = 0;
  const scrollingUp = window.scrollY < revealLastScrollY;
  revealLastScrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  revealElements.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
    const referenceHeight = Math.max(1, Math.min(rect.height, viewportHeight));
    const visibleRatio = visibleHeight / referenceHeight;
    const enteringViewport = rect.top < viewportHeight * 0.92 && rect.bottom > viewportHeight * 0.06;
    const leavingBelowLikeSideRail = scrollingUp && rect.top >= viewportHeight - referenceHeight * 0.5;
    const almostHiddenBelow = rect.top > viewportHeight * 0.92 && visibleRatio <= 0.1;
    const hiddenAbove = rect.bottom <= 0;
    if (leavingBelowLikeSideRail) {
      hideReveal(element);
      return;
    }
    if (enteringViewport) {
      showReveal(element);
      return;
    }
    if (almostHiddenBelow || hiddenAbove) hideReveal(element);
  });
};
const scheduleReveals = () => {
  if (revealFrame) return;
  revealFrame = window.requestAnimationFrame(syncReveals);
};
syncReveals();
window.addEventListener("scroll", scheduleReveals, { passive: true });
window.addEventListener("resize", scheduleReveals);

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
