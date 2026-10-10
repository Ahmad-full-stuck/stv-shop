import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, BadgeCheck, Check, ChevronDown, Clock, Copy as CopyIcon, Heart, Layers, MapPin, Mail, MessageCircle, PackageCheck, Ruler, RotateCcw, Scissors, Search, Send, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import { Link, useLocation, useSearch } from 'wouter'
import type { ProductFaq } from '@/types'
import { formatPrice, normalizeArabic } from '@/lib/catalog'
import { useT } from '@/lib/i18n'
import { guideFaqsEn, quickGuideAnswersEn } from '@/lib/strings/info'
import { fallbackCategories, fallbackProducts, guideQuestions, quickGuideAnswers } from '@/lib/fallback-data'
import { apiUrl } from '@/lib/site'
import { sendSimpleEmail } from '@/lib/email'
import { useSiteContent } from '@/lib/site-content'
import { mergeAdminCategories, mergeAdminProducts } from '@/components/AdminSecret'
import { SmartImage } from '@/components/ui/SmartImage'

const glassCss = `
.glass {
  background: linear-gradient(150deg, rgba(255, 255, 255, .8), rgba(255, 250, 250, .46));
  border: 1px solid rgba(255, 255, 255, .85);
  box-shadow: 0 24px 55px rgba(15, 15, 20, .08);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
}
.glass-card { padding: 26px; border-radius: 24px; }
.glass-dark {
  color: #fff;
  background: linear-gradient(150deg, rgba(15, 15, 20, .93), rgba(15, 15, 20, .76));
  border: 1px solid rgba(255, 255, 255, .16);
  box-shadow: 0 24px 55px rgba(15, 15, 20, .22);
  backdrop-filter: blur(18px) saturate(130%);
  -webkit-backdrop-filter: blur(18px) saturate(130%);
}
.glass-dark p, .glass-dark small, .glass-dark li { color: #b0b0b5; }
.glass-dark .eyebrow { color: var(--stv-red); }
.glass-dark .button-outline { color: #fff; border-color: rgba(255, 255, 255, .4); }
.glass-dark .button-outline:hover { color: #fff; border-color: #fff; background: rgba(255, 255, 255, .14); }
.glass-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 16px;
  color: var(--stv-red);
  background: rgba(255, 255, 255, .68);
  border: 1px solid rgba(255, 255, 255, .92);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(15, 15, 20, .06);
}
.glass-input {
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  color: var(--stv-ink);
  background: rgba(255, 255, 255, .74);
  border: 1px solid rgba(255, 255, 255, .95);
  border-radius: 14px;
  outline: 0;
  font-size: 13px;
  transition: border-color .2s ease, box-shadow .2s ease;
}
.glass-input::placeholder { color: #a9938e; }
.glass-input:focus { border-color: rgba(225, 29, 46, .55); box-shadow: 0 0 0 3px rgba(225, 29, 46, .14); }
textarea.glass-input { min-height: 132px; resize: vertical; line-height: 1.9; }
.section-soft {
  padding: 46px 40px;
  background: linear-gradient(160deg, rgba(255, 255, 255, .74), rgba(241, 232, 224, .88));
  border: 1px solid rgba(255, 255, 255, .85);
  border-radius: 26px;
  box-shadow: 0 18px 44px rgba(15, 15, 20, .06);
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: var(--stv-red);
  background: rgba(225, 29, 46, .09);
  border: 1px solid rgba(225, 29, 46, .22);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  transition: background-color .2s ease, border-color .2s ease, color .2s ease;
}
.chip:hover { background: rgba(225, 29, 46, .16); border-color: rgba(225, 29, 46, .5); }
.chip-neutral { color: var(--stv-muted); background: rgba(255, 255, 255, .62); border-color: rgba(232, 220, 211, .95); }
.chip-neutral:hover { color: var(--stv-red); border-color: rgba(225, 29, 46, .4); }
.chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
.stars { display: inline-flex; align-items: center; gap: 3px; color: #e0a13c; }
.stars svg { width: 14px; height: 14px; fill: currentColor; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.steps-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }

.about-values { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.stat-card { position: relative; overflow: hidden; }
.stat-card:before {
  content: '';
  position: absolute;
  right: -34px;
  bottom: -40px;
  width: 128px;
  height: 128px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(225, 29, 46, .2), rgba(225, 29, 46, 0));
}
.stat-label { position: relative; display: block; color: var(--stv-muted); font-size: 11.5px; }
.stat-value { position: relative; display: block; margin-top: 8px; color: var(--stv-red); font-size: clamp(30px, 4vw, 40px); line-height: 1.15; letter-spacing: -.02em; }
.stat-note { position: relative; display: block; margin-top: 6px; color: var(--stv-muted); font-size: 11.5px; line-height: 1.7; }
.value-card h3 { margin-top: 14px; font-size: 14px; }
.value-card p { margin-top: 7px; color: var(--stv-muted); font-size: 12px; line-height: 1.95; }
.value-icon { width: 42px; height: 42px; display: grid; place-items: center; color: var(--stv-red); background: rgba(225, 29, 46, .1); border: 1px solid rgba(225, 29, 46, .2); border-radius: 14px; }
.timeline { position: relative; display: grid; gap: 14px; margin: 26px 0 0; padding: 0; list-style: none; }
.timeline:before {
  content: '';
  position: absolute;
  top: 14px;
  bottom: 14px;
  right: 14px;
  width: 1px;
  background: linear-gradient(180deg, rgba(225, 29, 46, .55), rgba(216, 198, 187, .8));
}
.timeline-item { position: relative; display: grid; grid-template-columns: 29px minmax(0, 1fr); gap: 15px; align-items: start; }
.timeline-dot {
  width: 29px;
  height: 29px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--stv-red);
  border-radius: 50%;
  font-size: 11.5px;
  font-weight: 600;
  box-shadow: 0 0 0 5px rgba(225, 29, 46, .12);
}
.timeline-body { padding: 18px 20px; }
.timeline-year { display: block; color: var(--stv-red); font-size: 11.5px; font-weight: 600; letter-spacing: .04em; }
.timeline-body strong { display: block; margin-top: 5px; font-size: 14px; }
.timeline-body p { margin-top: 6px; color: var(--stv-muted); font-size: 12px; line-height: 1.95; }
.quote-card { display: flex; flex-direction: column; gap: 12px; }
.quote-text { color: var(--stv-ink); font-size: 13px; line-height: 2; }
.quote-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 12px; border-top: 1px solid rgba(232, 220, 211, .9); }
.quote-name { display: grid; gap: 2px; }
.quote-name strong { font-size: 12px; }
.quote-name small { color: var(--stv-muted); font-size: 11.5px; }
.about-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 22px; margin-top: 55px; padding: 38px 40px; border-radius: 26px; }
.about-cta h2 { margin-top: 8px; font-size: clamp(22px, 3vw, 30px); }
.about-cta p { max-width: 470px; margin-top: 9px; color: #cdbdba; font-size: 13px; line-height: 2; }
.cta-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.section-head-tight { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.section-head-tight h2 { margin-top: 7px; font-size: clamp(22px, 3.2vw, 31px); line-height: 1.4; }
.section-head-tight p { margin-top: 7px; color: var(--stv-muted); font-size: 13px; line-height: 1.9; }
.story-copy-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 22px; }
.story-copy-grid p { color: var(--stv-muted); font-size: 13px; line-height: 2.1; }
.tips-table-wrap { overflow-x: auto; border: 1px solid rgba(255, 255, 255, .85); border-radius: 20px; background: rgba(255, 255, 255, .58); }
.tips-table { width: 100%; min-width: 660px; border-collapse: collapse; font-size: 12px; }
.tips-table caption { padding: 15px 18px 0; color: var(--stv-muted); font-size: 11.5px; text-align: right; }
.tips-table th, .tips-table td { padding: 13px 16px; text-align: right; vertical-align: top; }
.tips-table thead th { color: #fff; background: rgba(15, 15, 20, .94); font-size: 11.5px; font-weight: 600; }
.tips-table tbody tr + tr { border-top: 1px solid rgba(232, 220, 211, .95); }
.tips-table tbody tr:nth-child(even) { background: rgba(255, 255, 255, .5); }
.tips-table tbody th { color: var(--stv-red); font-weight: 600; }
.tips-table td small { display: block; margin-top: 3px; color: var(--stv-muted); font-size: 11.5px; line-height: 1.7; }
.table-hint { display: none; margin-top: 9px; color: var(--stv-muted); font-size: 11.5px; }
.guide-checklist { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin: 20px 0 0; padding: 0; }
.guide-checklist li {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 13px 15px;
  list-style: none;
  background: rgba(255, 255, 255, .62);
  border: 1px solid rgba(255, 255, 255, .9);
  border-radius: 16px;
  font-size: 12px;
  line-height: 1.85;
}
.guide-checklist svg { flex: 0 0 auto; margin-top: 4px; color: var(--stv-green); }
.contact-hours { display: grid; gap: 10px; margin-top: 24px; padding: 20px 22px; border-radius: 20px; }
.hours-title { display: flex; align-items: center; gap: 8px; color: var(--stv-red); font-size: 12px; font-weight: 600; }
.hours-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-bottom: 9px; border-bottom: 1px solid rgba(232, 220, 211, .9); color: var(--stv-muted); font-size: 11.5px; }
.hours-row:last-child { padding-bottom: 0; border-bottom: 0; }
.hours-row strong { color: var(--stv-ink); font-size: 11.5px; }
.map-card { position: relative; overflow: hidden; display: grid; gap: 16px; margin-top: 16px; padding: 24px; border-radius: 24px; }
.map-grid {
  position: absolute;
  inset: 0;
  opacity: .55;
  background-image: linear-gradient(rgba(255, 255, 255, .08) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, .08) 1px, transparent 1px);
  background-size: 34px 34px;
}
.map-copy { position: relative; display: grid; gap: 9px; justify-items: start; }
.map-pin { width: 40px; height: 40px; display: grid; place-items: center; color: #fff; background: var(--stv-red); border-radius: 50%; box-shadow: 0 10px 24px rgba(225, 29, 46, .45); }
.map-copy strong { font-size: 14px; }
.map-copy p { color: #cdbdba; font-size: 12px; line-height: 2; }
.map-card .button { position: relative; }
.contact-form { border-radius: 24px; }
.form-status { display: flex; align-items: flex-start; gap: 9px; margin-top: 16px; padding: 14px 16px; border-radius: 16px; font-size: 12px; line-height: 1.9; }
.form-status svg { flex: 0 0 auto; margin-top: 4px; }
.form-status-error { color: #9a463c; background: #f9ece7; border: 1px solid #edcfc6; }
.form-status-success { color: var(--stv-green); background: #edf4eb; border: 1px solid #d8e7d4; }
.form-status-info { color: var(--stv-red); background: rgba(225, 29, 46, .08); border: 1px solid rgba(225, 29, 46, .24); }
.form-status a { font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.form-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
.policy-accordions { display: grid; gap: 12px; max-width: 880px; }
.policy-accordion { padding: 0 24px; transition: border-color .2s ease, box-shadow .2s ease; }
.policy-accordion summary { min-height: 68px; display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 12px; cursor: pointer; list-style: none; }
.policy-accordion summary::-webkit-details-marker { display: none; }
.policy-accordion summary > span { color: var(--stv-red); font-size: 11.5px; font-weight: 600; }
.policy-accordion summary strong { font-size: 14px; transition: color .2s ease; }
.policy-accordion summary:hover strong { color: var(--stv-red); }
.policy-accordion summary svg { color: var(--stv-muted); transition: transform .2s ease; }
.policy-accordion[open] { border-color: rgba(225, 29, 46, .4); box-shadow: 0 24px 55px rgba(225, 29, 46, .12); }
.policy-accordion[open] summary svg { transform: rotate(180deg); }
.policy-body { padding-bottom: 24px; }
.policy-body p { color: var(--stv-muted); font-size: 13px; line-height: 2.1; }
.policy-body ul { display: grid; gap: 8px; margin: 12px 0 0; padding-inline-start: 18px; color: var(--stv-muted); font-size: 12px; line-height: 1.95; }
.policy-body li::marker { color: var(--stv-red); }
.policy-body p.policy-highlight { display: flex; align-items: center; gap: 8px; margin-top: 14px; padding: 12px 14px; color: var(--stv-red); background: rgba(225, 29, 46, .08); border: 1px solid rgba(225, 29, 46, .2); border-radius: 14px; font-size: 11.5px; line-height: 1.8; }
.policy-body p.policy-highlight svg { flex: 0 0 auto; }
.form-footnote a { color: var(--stv-red); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
.chip-dark { color: #ffe9df; background: rgba(255, 248, 241, .12); border-color: rgba(255, 248, 241, .3); }
.chip-dark:hover { background: rgba(255, 248, 241, .2); border-color: rgba(255, 248, 241, .55); }
.tracking-form input:focus-visible { outline: 3px solid rgba(225, 29, 46, .35); outline-offset: 3px; border-radius: 6px; }
.confirmation-panel { width: min(780px, 100%); padding: 44px 38px; }
.confirmation-panel h1 { margin-top: 9px; font-size: clamp(28px, 4.4vw, 44px); }
.confirmation-panel > p { max-width: 470px; margin: 12px auto 0; color: var(--stv-muted); font-size: 13px; line-height: 2; }
.status-panel { margin-top: 26px; padding: 26px; border-radius: 22px; text-align: right; }
.status-head { display: grid; gap: 4px; padding-bottom: 16px; border-bottom: 1px solid rgba(255, 255, 255, .14); }
.status-head span { color: #f0a98a; font-size: 11.5px; }
.status-head strong { font-size: 16px; }
.status-head small { color: #bcaeaa; font-size: 11.5px; }
.status-steps { display: grid; gap: 14px; margin: 18px 0 0; padding: 0; list-style: none; }
.status-steps li { position: relative; display: grid; grid-template-columns: 30px minmax(0, 1fr); gap: 12px; align-items: center; }
.status-steps li:not(:last-child):after { content: ''; position: absolute; top: 30px; bottom: -14px; right: 14px; width: 1px; background: rgba(255, 255, 255, .16); }
.status-steps li > span { width: 30px; height: 30px; display: grid; place-items: center; color: #cdbdba; background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .2); border-radius: 50%; font-size: 11.5px; z-index: 1; }
.status-steps li.is-done > span { color: #fff; background: var(--stv-green); border-color: var(--stv-green); }
.status-steps li.is-done:not(:last-child):after { background: rgba(73, 118, 91, .75); }
.status-steps strong { display: block; font-size: 12px; }
.status-steps small { display: block; margin-top: 2px; color: #bcaeaa; font-size: 11.5px; }
.status-items { display: grid; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255, 255, 255, .14); }
.status-items > span { color: #f0a98a; font-size: 11.5px; }
.status-item { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #cdbdba; font-size: 11.5px; }
.status-item b { color: #fff; font-weight: 600; }
.order-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.order-empty { width: min(660px, 100%); margin: 40px auto 0; padding: 42px 30px; border-radius: 28px; text-align: center; }
.order-empty h1 { margin-top: 16px; font-size: clamp(24px, 3.6vw, 32px); }
.order-empty > p { max-width: 440px; margin: 10px auto 0; color: var(--stv-muted); font-size: 13px; line-height: 2; }
.order-empty .empty-icon { margin: 0 auto; }
.empty-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 24px; }
.local-orders { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; margin-top: 22px; }
.local-orders > span { color: var(--stv-muted); font-size: 11.5px; }
.tracking-card, .tracking-card.glass { border-radius: 26px; }
.tracking-result-glass { display: flex; align-items: flex-start; gap: 10px; margin-top: 22px; padding: 16px; border-radius: 18px; text-align: right; }
.tracking-result-glass > div { display: grid; gap: 5px; }
.tracking-result-glass strong { font-size: 13px; }
.tracking-result-glass p { color: var(--stv-muted); font-size: 11.5px; line-height: 1.9; }
.favorites-grid .favorite-tile { padding: 12px 12px 14px; border-radius: 22px; }
.favorite-tile-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(232, 220, 211, .9); }
.favorite-tile-actions .chip { cursor: pointer; }
.empty-glass { width: min(660px, 100%); margin: 40px auto 0; padding: 42px 30px; border-radius: 28px; text-align: center; }
.empty-glass .empty-icon { margin: 0 auto; }
.empty-glass h1 { margin-top: 20px; font-size: clamp(24px, 3.8vw, 32px); }
.empty-glass > p { max-width: 430px; margin: 9px auto 0; color: var(--stv-muted); font-size: 13px; line-height: 2; }
.favorites-note { margin-top: 45px; }
.not-found-page { min-height: 74vh; display: flex; align-items: center; justify-content: center; padding: 70px 0 90px; }
.not-found-card { position: relative; overflow: hidden; width: min(720px, 100%); padding: 52px 40px; border-radius: 30px; text-align: center; }
.not-found-code { display: block; color: rgba(225, 29, 46, .18); font-size: clamp(74px, 16vw, 132px); font-weight: 700; line-height: .95; letter-spacing: -.06em; }
.not-found-card h1 { margin-top: 6px; font-size: clamp(26px, 4vw, 38px); }
.not-found-card > p { max-width: 470px; margin: 12px auto 0; color: var(--stv-muted); font-size: 13px; line-height: 2; }
.not-found-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 26px; }
.not-found-links { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 26px; padding-top: 22px; border-top: 1px solid rgba(232, 220, 211, .9); }
@media (min-width: 720px) {
  .status-steps { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .status-steps li { grid-template-columns: minmax(0, 1fr); justify-items: center; gap: 8px; text-align: center; }
  .status-steps li:not(:last-child):after { top: 15px; right: auto; bottom: auto; left: 50%; width: 100%; height: 1px; }
}
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .about-values { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .steps-grid { grid-template-columns: minmax(0, 1fr); }
  .section-soft { padding: 34px 24px; }
  .story-copy-grid { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
  .guide-checklist { grid-template-columns: minmax(0, 1fr); }
  .table-hint { display: block; }
  .section-head-tight { flex-direction: column; align-items: flex-start; gap: 12px; }
  .about-cta { padding: 28px 22px; }
  .confirmation-panel { padding: 34px 20px; }
}
@media (max-width: 560px) {
  .stats-grid, .about-values { grid-template-columns: minmax(0, 1fr); }
  .favorites-grid { grid-template-columns: minmax(0, 1fr); }
  .glass-card { padding: 20px 18px; }
  .confirmation-panel { padding: 34px 20px; }
  .timeline:before { right: 14px; }
  .policy-accordion { padding: 0 16px; }
  .not-found-card { padding: 38px 20px; }
  .order-empty, .empty-glass { padding: 32px 18px; }
}
`;

export function GlassStyles() {
  return <style>{glassCss}</style>
}
interface AboutStat {
  label: string
  value: number
  note: string
}

const catalogCounts = (): { products: number; categories: number } => ({
  products: mergeAdminProducts(fallbackProducts).length,
  categories: mergeAdminCategories(fallbackCategories).length,
})

const buildAboutStats = (): AboutStat[] => {
  const counts = catalogCounts()
  return [
    { label: 'about.stat1Label', value: counts.products, note: 'about.stat1Note' },
    { label: 'about.stat2Label', value: counts.categories, note: 'about.stat2Note' },
    { label: 'about.stat3Label', value: 18, note: 'about.stat3Note' },
    { label: 'about.stat4Label', value: 201, note: 'about.stat4Note' },
  ]
}

const aboutValues = [
  { title: 'about.value1Title', text: 'about.value1Text', icon: <BadgeCheck size={18} /> },
  { title: 'about.value2Title', text: 'about.value2Text', icon: <ShieldCheck size={18} /> },
  { title: 'about.value3Title', text: 'about.value3Text', icon: <MessageCircle size={18} /> },
  { title: 'about.value4Title', text: 'about.value4Text', icon: <Ruler size={18} /> },
]

const buildAboutTimeline = () => {
  return [
    { year: 'about.timeline1Year', title: 'about.timeline1Title', text: 'about.timeline1Text' },
    { year: 'about.timeline2Year', title: 'about.timeline2Title', text: 'about.timeline2Text' },
    { year: 'about.timeline3Year', title: 'about.timeline3Title', text: 'about.timeline3Text' },
  ]
}

export function AboutPage() {
  const { t, lang } = useT()
  const content = useSiteContent()
  const aboutStats = buildAboutStats()
  const aboutTimeline = buildAboutTimeline()
  const productsCount = catalogCounts().products.toLocaleString(lang === 'en' ? 'en-US' : 'ar-IQ')
  return (
    <>
      <GlassStyles />
      <main className="container-stv info-page">
        <div className="breadcrumbs"><Link href="/">{t('about.crumbHome')}</Link><span>›</span><span>{t('about.crumbCurrent')}</span></div>

        <section className="about-hero">
          <div className="about-copy">
            <span className="eyebrow"><Sparkles size={14} />{t('about.eyebrow')}</span>
            <h1>{content.aboutTitle}</h1>
            <p>{content.aboutText}</p>
            <div className="chip-row" style={{ marginTop: '22px' }}>
              <span className="chip"><Ruler size={13} />{t('about.chipOrder')}</span>
              <span className="chip"><ShieldCheck size={13} />{t('about.chipSpecs')}</span>
              <span className="chip"><Truck size={13} />{t('about.chipDelivery')}</span>
            </div>
            <div className="about-points">
              <div><span>{t('about.point1Num')}</span><strong>{t('about.point1Title')}</strong><p>{t('about.point1Text')}</p></div>
              <div><span>{t('about.point2Num')}</span><strong>{t('about.point2Title')}</strong><p>{t('about.point2Text')}</p></div>
              <div><span>{t('about.point3Num')}</span><strong>{t('about.point3Title')}</strong><p>{t('about.point3Text')}</p></div>
            </div>
          </div>
          <div className="about-collage">
            <SmartImage src="home/hero-2.svg" alt={t('about.imgAlt1')} sizes="(max-width: 820px) 46vw, 24vw" />
            <SmartImage src="home/hero-3.svg" alt={t('about.imgAlt2')} sizes="(max-width: 820px) 46vw, 24vw" />
            <span>STV<br /><strong>SHOP</strong></span>
          </div>
        </section>

        <section className="section-soft" aria-labelledby="about-story-title">
          <div className="section-head-tight">
            <div>
              <span className="eyebrow">{t('about.storyEyebrow')}</span>
              <h2 id="about-story-title">{t('about.storyTitle')}</h2>
            </div>
            <Link href="/fabric-guide" className="underlined-link">{t('about.storyLink')} <ArrowLeft size={15} /></Link>
          </div>
          <div className="story-copy-grid">
            <p>{t('about.storyP1')}</p>
            <p>{t('about.storyP2').replace('{count}', productsCount)}</p>
          </div>
        </section>

        <section className="section-block" aria-labelledby="about-stats-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('about.statsEyebrow')}</span>
              <h2 id="about-stats-title">{t('about.statsTitle')}</h2>
              <p>{t('about.statsText')}</p>
            </div>
          </div>
          <div className="stats-grid">{aboutStats.map((stat) => <StatCard key={stat.label} stat={stat} />)}</div>
        </section>

        <section className="section-block" aria-labelledby="about-values-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('about.valuesEyebrow')}</span>
              <h2 id="about-values-title">{t('about.valuesTitle')}</h2>
              <p>{t('about.valuesText')}</p>
            </div>
          </div>
          <div className="about-values">{aboutValues.map((value) => <article className="glass-card value-card" key={value.title}><span className="value-icon">{value.icon}</span><h3>{t(value.title)}</h3><p>{t(value.text)}</p></article>)}</div>
        </section>

        <section className="section-soft" aria-labelledby="about-timeline-title">
          <div className="section-head-tight">
            <div>
              <span className="eyebrow">{t('about.timelineEyebrow')}</span>
              <h2 id="about-timeline-title">{t('about.timelineTitle')}</h2>
            </div>
            <span className="chip chip-neutral">{t('about.timelineChip')}</span>
          </div>
          <ol className="timeline">
            {aboutTimeline.map((item, index) => (
              <li className="timeline-item" key={item.year}>
                <span className="timeline-dot" aria-hidden="true">{index + 1}</span>
                <div className="glass-card timeline-body">
                  <span className="timeline-year">{t(item.year)}</span>
                  <strong>{t(item.title)}</strong>
                  <p>{t(item.text).replace('{count}', productsCount)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="about-cta glass-dark">
          <div>
            <span className="eyebrow"><Sparkles size={14} />{t('about.ctaEyebrow')}</span>
            <h2>{t('about.ctaTitle')}</h2>
            <p>{t('about.ctaText')}</p>
          </div>
          <div className="cta-actions">
            <Link href="/catalog" className="button button-primary">{t('about.ctaBrowse')} <ArrowLeft size={16} /></Link>
            <Link href="/contact" className="button button-outline"><MessageCircle size={16} />{t('about.ctaAsk')}</Link>
          </div>
        </section>
      </main>
    </>
  )
}

function StatCard({ stat }: { stat: AboutStat }) {
  const { t, lang } = useT()
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const startedRef = useRef(false)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const node = nodeRef.current
    const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setValue(stat.value)
      return undefined
    }
    let frame = 0
    const run = () => {
      const startedAt = performance.now()
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / 1100)
        setValue(Math.round(stat.value * (1 - Math.pow(1 - progress, 3))))
        if (progress < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }
    if (!node || typeof IntersectionObserver === 'undefined') {
      run()
      return () => cancelAnimationFrame(frame)
    }
    const rect = node.getBoundingClientRect()
    if (rect.top < (window.innerHeight || 0) * 0.85) {
      run()
      return () => cancelAnimationFrame(frame)
    }
    const guard = window.setTimeout(() => {
      if (!startedRef.current) {
        startedRef.current = true
        run()
      }
    }, 1000)
    const observer = new IntersectionObserver((entries) => {
      if (!startedRef.current && entries.some((entry) => entry.isIntersecting)) {
        startedRef.current = true
        window.clearTimeout(guard)
        run()
      }
    }, { threshold: 0.2 })
    observer.observe(node)
    return () => {
      observer.disconnect()
      window.clearTimeout(guard)
      cancelAnimationFrame(frame)
    }
  }, [stat.value])

  return (
    <div className="glass-card stat-card" ref={nodeRef}>
      <span className="stat-label">{t(stat.label)}</span>
      <strong className="stat-value" aria-label={`${stat.value} ${t(stat.label)}`}>{value.toLocaleString(lang === 'en' ? 'en-US' : 'ar-IQ')}</strong>
      <span className="stat-note">{t(stat.note)}</span>
    </div>
  )
}
const extraGuideQuestions = (t: (key: string) => string): ProductFaq[] => [
  { question: t('guide.extraQ1Question'), answer: t('guide.extraQ1Answer') },
  { question: t('guide.extraQ2Question'), answer: t('guide.extraQ2Answer') },
  { question: t('guide.extraQ3Question'), answer: t('guide.extraQ3Answer') },
  { question: t('guide.extraQ4Question'), answer: t('guide.extraQ4Answer') },
  { question: t('guide.extraQ5Question'), answer: t('guide.extraQ5Answer') },
]

const fabricTips = [
  { use: 'guide.tip1Use', fabric: 'guide.tip1Fabric', weight: 'guide.tip1Weight', tip: 'guide.tip1Tip' },
  { use: 'guide.tip2Use', fabric: 'guide.tip2Fabric', weight: 'guide.tip2Weight', tip: 'guide.tip2Tip' },
  { use: 'guide.tip3Use', fabric: 'guide.tip3Fabric', weight: 'guide.tip3Weight', tip: 'guide.tip3Tip' },
  { use: 'guide.tip4Use', fabric: 'guide.tip4Fabric', weight: 'guide.tip4Weight', tip: 'guide.tip4Tip' },
  { use: 'guide.tip5Use', fabric: 'guide.tip5Fabric', weight: 'guide.tip5Weight', tip: 'guide.tip5Tip' },
  { use: 'guide.tip6Use', fabric: 'guide.tip6Fabric', weight: 'guide.tip6Weight', tip: 'guide.tip6Tip' },
]

const qualityChecks = [
  'guide.check1',
  'guide.check2',
  'guide.check3',
  'guide.check4',
  'guide.check5',
  'guide.check6',
]

export function FabricGuidePage() {
  const { t, lang } = useT()
  const questions: ProductFaq[] = [...(lang === 'en' ? guideFaqsEn : guideQuestions), ...extraGuideQuestions(t)]
  const quickAnswers = lang === 'en' ? quickGuideAnswersEn : quickGuideAnswers
  const [openQuick, setOpenQuick] = useState<number | null>(0)
  const [openGuide, setOpenGuide] = useState<number | null>(0)
  return (
    <>
      <GlassStyles />
      <main className="container-stv info-page">
        <div className="breadcrumbs"><Link href="/">{t('guide.crumbHome')}</Link><span>›</span><span>{t('guide.crumbCurrent')}</span></div>

        <section className="info-heading">
          <span className="eyebrow"><Ruler size={14} />{t('guide.heroEyebrow')}</span>
          <h1>{t('guide.heroTitle')}</h1>
          <p>{t('guide.heroText')}</p>
        </section>

        <section className="quick-answers" aria-labelledby="quick-answers-title">
          <div className="section-head-tight">
            <div>
              <span className="eyebrow"><MessageCircle size={14} />{t('guide.quickEyebrow')}</span>
              <h2 id="quick-answers-title">{t('guide.quickTitle')}</h2>
              <p>{t('guide.quickText')}</p>
            </div>
            <a href="#guide-faq-title" className="underlined-link" onClick={(event) => { event.preventDefault(); document.getElementById('guide-faq-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }}>{t('guide.quickLink')} <ArrowLeft size={15} /></a>
          </div>
          <div className="quick-answers-grid">
            {quickAnswers.map((entry, index) => (
              <article className={`quick-answer ${openQuick === index ? 'is-open' : ''}`} key={entry.question}>
                <button type="button" onClick={() => setOpenQuick(openQuick === index ? null : index)} aria-expanded={openQuick === index}>
                  <strong>{entry.question}</strong>
                  <ChevronDown size={16} />
                </button>
                {openQuick === index && (
                  <ul>
                    {entry.answers.map((answer) => <li key={answer}>{answer}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="steps-grid" aria-label={t('guide.stepsAria')}>
          <article className="glass-card">
            <span className="chip">{t('guide.stepChip1')}</span>
            <div className="value-card"><h3>{t('guide.step1Title')}</h3><p>{t('guide.step1Text')}</p></div>
          </article>
          <article className="glass-card">
            <span className="chip">{t('guide.stepChip2')}</span>
            <div className="value-card"><h3>{t('guide.step2Title')}</h3><p>{t('guide.step2Text')}</p></div>
          </article>
          <article className="glass-card">
            <span className="chip">{t('guide.stepChip3')}</span>
            <div className="value-card"><h3>{t('guide.step3Title')}</h3><p>{t('guide.step3Text')}</p></div>
          </article>
        </section>

        <section className="section-block" aria-labelledby="guide-faq-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('guide.faqEyebrow')}</span>
              <h2 id="guide-faq-title">{t('guide.faqTitle')}</h2>
              <p>{t('guide.faqText')}</p>
            </div>
            <Link href="/contact" className="underlined-link">{t('guide.faqLink')} <ArrowLeft size={15} /></Link>
          </div>
          <div className="guide-grid">
            {questions.map((item, index) => (
              <details className="guide-card" key={item.question} open={openGuide === index}>
                <summary
                  onClick={(event) => { event.preventDefault(); setOpenGuide(openGuide === index ? null : index) }}
                  aria-expanded={openGuide === index}
                >
                  <span>{index + 1 < 10 ? t('guide.faqPad').replace('{n}', String(index + 1)) : index + 1}</span>
                  <strong>{item.question}</strong>
                  <ChevronDown size={18} />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="section-soft" aria-labelledby="guide-tips-title">
          <div className="section-head-tight">
            <div>
              <span className="eyebrow">{t('guide.tipsEyebrow')}</span>
              <h2 id="guide-tips-title">{t('guide.tipsTitle')}</h2>
              <p>{t('guide.tipsText')}</p>
            </div>
            <span className="chip"><Layers size={13} />{t('guide.tipsChip')}</span>
          </div>
          <div className="tips-table-wrap" role="region" aria-label={t('guide.tipsAria')} tabIndex={0}>
            <table className="tips-table">
              <caption>{t('guide.tipsCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('guide.thUse')}</th>
                  <th scope="col">{t('guide.thFabric')}</th>
                  <th scope="col">{t('guide.thWeight')}</th>
                  <th scope="col">{t('guide.thTip')}</th>
                </tr>
              </thead>
              <tbody>
                {fabricTips.map((row) => (
                  <tr key={row.use}>
                    <th scope="row">{t(row.use)}</th>
                    <td>{t(row.fabric)}</td>
                    <td>{t(row.weight)}</td>
                    <td>{t(row.tip)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="table-hint">{t('guide.tableHint')}</p>
        </section>

        <section className="section-block" aria-labelledby="guide-quality-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t('guide.qualityEyebrow')}</span>
              <h2 id="guide-quality-title">{t('guide.qualityTitle')}</h2>
              <p>{t('guide.qualityText')}</p>
            </div>
          </div>
          <ul className="guide-checklist">
            {qualityChecks.map((item) => <li key={item}><Check size={15} />{t(item)}</li>)}
          </ul>
          <div className="chip-row" style={{ marginTop: '22px' }}>
            <span className="chip"><Scissors size={13} />{t('guide.chipCut')}</span>
            <span className="chip"><Heart size={13} />{t('guide.chipCare')}</span>
            <span className="chip"><Clock size={13} />{t('guide.chipReply')}</span>
            <span className="chip"><ShieldCheck size={13} />{t('guide.chipConfirm')}</span>
          </div>
        </section>

        <div className="center-action">
          <Link href="/catalog" className="button button-primary">{t('guide.ctaStart')} <ArrowLeft size={16} /></Link>
        </div>
      </main>
    </>
  )
}
interface ContactErrors {
  name?: string
  phone?: string
  message?: string
}

const validIraqiPhone = (value: string): boolean => /^(?:07\d{9}|9647\d{9}|\+9647\d{9})$/.test(value.replace(/[\s()-]/g, ''))

export function ContactPage() {
  const { t } = useT()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<ContactErrors>({})
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const content = useSiteContent()

  const composeText = (): string => t('contact.emailBody')
    .replace('{name}', name.trim())
    .replace('{phone}', phone.trim())
    .replace('{message}', message.trim())

  const validate = (): boolean => {
    const next: ContactErrors = {}
    const cleanName = name.trim()
    const cleanPhone = phone.replace(/[\s()-]/g, '')
    const cleanMessage = message.trim()
    if (cleanName.length < 3) next.name = t('contact.errorNameShort')
    else if (!/[ء-يA-Za-z]/.test(cleanName)) next.name = t('contact.errorNameScript')
    if (!validIraqiPhone(cleanPhone)) next.phone = t('contact.errorPhone')
    if (cleanMessage.length < 10) next.message = t('contact.errorMessage')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setState('sending')
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 4500)
    try {
      const response = await fetch(apiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.replace(/[\s()-]/g, ''), message: message.trim() }),
        signal: controller.signal,
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.includes('json')) throw new Error('contact-endpoint-unavailable')
      await response.json().catch(() => null)
      setState('sent')
    } catch {
      window.clearTimeout(timer)
      const mailed = await sendSimpleEmail({
        to: content.emailOrdersTo,
        action: content.emailFormSubmitAction || undefined,
        subject: t('contact.emailSubject'),
        body: composeText(),
        fields: { name: name.trim(), phone: phone.replace(/[\s()-]/g, '') },
      })
      setState(mailed ? 'sent' : 'failed')
      return
    }
    window.clearTimeout(timer)
  }

  const reset = () => {
    setName('')
    setPhone('')
    setMessage('')
    setErrors({})
    setState('idle')
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv info-page">
        <div className="breadcrumbs"><Link href="/">{t('contact.crumbHome')}</Link><span>›</span><span>{t('contact.crumbCurrent')}</span></div>

        <section className="contact-layout">
          <div className="contact-intro">
            <span className="eyebrow"><Mail size={14} />{t('contact.eyebrow')}</span>
            <h1>{content.contactTitle}</h1>
            <p>{content.contactText}</p>

            <div className="contact-methods">
              <a href="#contact-form" aria-label={t('contact.method1Aria')}>
                <Send size={19} /><span><strong>{t('contact.method1Title')}</strong><small>{t('contact.method1Text')}</small></span><ArrowLeft size={15} />
              </a>
              <Link href="/order-tracking" aria-label={t('contact.method2Aria')}>
                <PackageCheck size={19} /><span><strong>{t('contact.method2Title')}</strong><small>{t('contact.method2Text')}</small></span><ArrowLeft size={15} />
              </Link>
              <Link href="/fabric-guide" aria-label={t('contact.method3Aria')}>
                <Ruler size={19} /><span><strong>{t('contact.method3Title')}</strong><small>{t('contact.method3Text')}</small></span><ArrowLeft size={15} />
              </Link>
            </div>

            <div className="contact-hours glass-card">
              <span className="hours-title"><Clock size={15} />{t('contact.hoursTitle')}</span>
              <div className="hours-row"><span>{t('contact.hours1Label')}</span><strong>{t('contact.hours1Value')}</strong></div>
              <div className="hours-row"><span>{t('contact.hours2Label')}</span><strong>{t('contact.hours2Value')}</strong></div>
              <div className="hours-row"><span>{t('contact.hours3Label')}</span><strong>{t('contact.hours3Value')}</strong></div>
            </div>

            <div className="map-card glass-dark">
              <span className="map-grid" aria-hidden="true" />
              <div className="map-copy">
                <span className="map-pin"><MapPin size={18} /></span>
                <strong>{t('contact.mapTitle')}</strong>
                <p>{t('contact.mapText')}</p>
              </div>
            </div>
          </div>

          <form id="contact-form" className="contact-form glass" onSubmit={submit} noValidate>
            <div className="section-head-tight" style={{ marginBottom: '18px' }}>
              <div>
                <span className="eyebrow"><Send size={14} />{t('contact.formEyebrow')}</span>
                <h2>{t('contact.formTitle')}</h2>
              </div>
              <span className="chip chip-neutral">{t('contact.formChip')}</span>
            </div>

            <div className="form-fields">
              <div className="field">
                <label htmlFor="contact-name">{t('contact.nameLabel')} <small>{t('contact.required')}</small></label>
                <input id="contact-name" className="glass-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t('contact.namePlaceholder')} autoComplete="name" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'contact-name-error' : undefined} />
                {errors.name && <small className="field-error" id="contact-name-error">{errors.name}</small>}
              </div>
              <div className="field">
                <label htmlFor="contact-phone">{t('contact.phoneLabel')} <small>{t('contact.required')}</small></label>
                <input id="contact-phone" className="glass-input" type="tel" dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="07XXXXXXXXX" autoComplete="tel" aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? 'contact-phone-error' : undefined} />
                {errors.phone && <small className="field-error" id="contact-phone-error">{errors.phone}</small>}
              </div>
              <div className="field">
                <label htmlFor="contact-message">{t('contact.messageLabel')} <small>{t('contact.required')}</small></label>
                <textarea id="contact-message" className="glass-input" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t('contact.messagePlaceholder')} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'contact-message-error' : undefined} />
                {errors.message && <small className="field-error" id="contact-message-error">{errors.message}</small>}
              </div>
            </div>

            {state === 'idle' || state === 'sending' ? (
              <button type="submit" className="button button-primary" disabled={state === 'sending'}>
                {state === 'sending' ? t('contact.sending') : <>{t('contact.send')} <Send size={16} /></>}
              </button>
            ) : null}

            {state === 'sent' && (
              <div className="form-status form-status-success" role="status">
                <Check size={16} />
                <span>{t('contact.sent')}</span>
              </div>
            )}

            {state === 'failed' && (
              <div className="form-status form-status-error" role="status">
                <Mail size={16} />
                <span>{t('contact.failed')}</span>
              </div>
            )}

            {state !== 'idle' && (
              <div className="form-actions">
                <button type="button" className="button button-outline" onClick={reset}>{t('contact.again')}</button>
                <Link href="/catalog" className="button button-primary">{t('contact.browse')} <ArrowLeft size={16} /></Link>
              </div>
            )}

            <p className="form-footnote">{t('contact.footnote')} <Link href="/policies#privacy">{t('contact.footnoteLink')}</Link>.</p>
          </form>
        </section>
      </main>
    </>
  )
}
interface PolicyContent {
  id: string
  title: string
  intro: string
  points: string[]
  note: string
}

const policies: PolicyContent[] = [
  {
    id: 'terms',
    title: 'policies.termsTitle',
    intro: 'policies.termsIntro',
    points: [
      'policies.termsPoint1',
      'policies.termsPoint2',
      'policies.termsPoint3',
      'policies.termsPoint4',
    ],
    note: 'policies.termsNote',
  },
  {
    id: 'privacy',
    title: 'policies.privacyTitle',
    intro: 'policies.privacyIntro',
    points: [
      'policies.privacyPoint1',
      'policies.privacyPoint2',
      'policies.privacyPoint3',
      'policies.privacyPoint4',
    ],
       note: 'policies.privacyNote',
  },
  {
    id: 'shipping',
    title: 'policies.shippingTitle',
    intro: 'policies.shippingIntro',
    points: [
      'policies.shippingPoint1',
      'policies.shippingPoint2',
      'policies.shippingPoint3',
      'policies.shippingPoint4',
    ],
    note: 'policies.shippingNote',
  },
  {
    id: 'returns',
    title: 'policies.returnsTitle',
    intro: 'policies.returnsIntro',
    points: [
      'policies.returnsPoint1',
      'policies.returnsPoint2',
      'policies.returnsPoint3',
      'policies.returnsPoint4',
    ],
    note: 'policies.returnsNote',
  },
]

export function PoliciesPage() {
  const { t } = useT()
  const [location] = useLocation()
  const [active, setActive] = useState<string | null>('terms')

  useEffect(() => {
    const fromRouter = location.includes('#') ? location.slice(location.indexOf('#') + 1) : ''
    const rawHash = typeof window !== 'undefined' ? window.location.hash : ''
    const fromHash = rawHash.includes('#') ? rawHash.slice(rawHash.lastIndexOf('#') + 1) : ''
    const target = [fromRouter, fromHash].find((value) => policies.some((item) => item.id === value))
    if (!target) return undefined
    setActive(target)
    const frame = window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [location])

  const openPolicy = (id: string) => {
    setActive(id)
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60)
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv info-page policies-page">
        <div className="breadcrumbs"><Link href="/">{t('policies.crumbHome')}</Link><span>›</span><span>{t('policies.crumbCurrent')}</span></div>

        <section className="info-heading">
          <span className="eyebrow"><ShieldCheck size={14} />{t('policies.eyebrow')}</span>
          <h1>{t('policies.title')}</h1>
          <p>{t('policies.intro')}</p>
        </section>

        <div className="policy-nav" role="group" aria-label={t('policies.navAria')}>
          {policies.map((item) => <button type="button" key={item.id} className="chip" onClick={() => openPolicy(item.id)}>{t(item.title)}</button>)}
        </div>

        <div className="policy-accordions">
          {policies.map((item, index) => (
            <details className="glass-card policy-accordion" id={item.id} key={item.id} open={active === item.id}>
              <summary onClick={(event) => { event.preventDefault(); setActive(active === item.id ? null : item.id) }} aria-expanded={active === item.id}>
                <span>{t('policies.numPad').replace('{n}', String(index + 1))}</span>
                <strong>{t(item.title)}</strong>
                <ChevronDown size={18} />
              </summary>
              <div className="policy-body">
                <p>{t(item.intro)}</p>
                <ul>{item.points.map((point) => <li key={point}>{t(point)}</li>)}</ul>
                <p className="policy-highlight"><ShieldCheck size={15} />{t(item.note)}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="center-action">
          <Link href="/contact" className="button button-primary">{t('policies.cta')} <ArrowLeft size={16} /></Link>
        </div>
      </main>
    </>
  )
}
interface StoredOrderItem {
  name: string
  color?: string
  size?: string
  quantity?: number
  total?: number
}

interface StoredOrder {
  orderNumber: string
  status?: string
  createdAt?: string
  customerName?: string
  phone?: string
  address?: string
  subtotal?: number
  deliveryFee?: number
  total?: number
  items?: StoredOrderItem[]
}

const ORDER_KEYS = ['stv-orders', 'stv-order', 'stv-last-order', 'stv-fabrics-orders', 'stv-fabrics-order', 'stv-checkout-order', 'stv-pending-order', 'stv-order-number']

const statusSteps = ['track.step1', 'track.step2', 'track.step3', 'track.step4', 'track.step5']

const STATUS_LABEL_KEYS: Record<string, string> = {
  'تم استلام الطلب': 'track.step1',
  'قيد المراجعة': 'track.step2',
  'جاهز للشحن': 'track.step3',
  'في الطريق إليك': 'track.step4',
  'تم التوصيل': 'track.step5',
  'تم التواصل': 'track.statusContacted',
  'تم الشحن': 'track.statusShipped',
  'قيد التوصيل': 'track.statusInTransit',
  'مكتمل': 'track.statusDone',
  'جديد': 'track.statusNew',
}

const readText = (record: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

const readNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[^\d.-]/g, ''))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

const looksLikeReference = (value: string): boolean => value.length >= 3 && value.length <= 40 && /^[\wء-ي-]+$/.test(value) && /\d/.test(value) && /[ء-يA-Za-z-]/.test(value)

const readItems = (value: unknown): StoredOrderItem[] => {
  if (!Array.isArray(value)) return []
  const items: StoredOrderItem[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const name = readText(record, ['productName', 'name', 'title', 'item'])
    if (!name) continue
    const item: StoredOrderItem = { name }
    const color = readText(record, ['colorName', 'color'])
    const size = readText(record, ['size'])
    const quantity = readNumber(record, ['quantity', 'length', 'meters'])
    const total = readNumber(record, ['totalPrice', 'total', 'price'])
    if (color) item.color = color
    if (size) item.size = size
    if (quantity !== undefined) item.quantity = quantity
    if (total !== undefined) item.total = total
    items.push(item)
  }
  return items
}

const orderFromRecord = (record: Record<string, unknown>, fallbackNumber: string): StoredOrder | null => {
  const orderNumber = readText(record, ['orderNumber', 'order_number', 'orderNo', 'number', 'reference', 'ref', 'orderId', 'order_id', 'id']) || fallbackNumber
  if (!orderNumber) return null
  const order: StoredOrder = { orderNumber }
  const status = readText(record, ['status', 'state', 'orderStatus', 'stage'])
  const createdAt = readText(record, ['createdAt', 'created_at', 'date', 'timestamp', 'updatedAt'])
  const customerName = readText(record, ['customerName', 'name', 'fullName'])
  const phone = readText(record, ['phone', 'customerPhone', 'mobile'])
  const address = readText(record, ['address', 'shippingAddress', 'deliveryAddress'])
  const items = readItems(record.items)
  const subtotal = readNumber(record, ['subtotal'])
  const deliveryFee = readNumber(record, ['deliveryFee', 'shipping', 'shippingFee'])
  const total = readNumber(record, ['total', 'grandTotal', 'amount'])
  if (status) order.status = status
  if (createdAt) order.createdAt = createdAt
  if (customerName) order.customerName = customerName
  if (phone) order.phone = phone
  if (address) order.address = address
  if (items.length) order.items = items
  if (subtotal !== undefined) order.subtotal = subtotal
  if (deliveryFee !== undefined) order.deliveryFee = deliveryFee
  if (total !== undefined) order.total = total
  return order
}

const collectOrders = (value: unknown, out: StoredOrder[]): void => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (looksLikeReference(trimmed)) out.push({ orderNumber: trimmed })
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) collectOrders(item, out)
    return
  }
  if (!value || typeof value !== 'object') return
  const record = value as Record<string, unknown>
  if (Array.isArray(record.orders)) {
    collectOrders(record.orders, out)
    return
  }
  const direct = orderFromRecord(record, '')
  if (direct) {
    out.push(direct)
    return
  }
  for (const [key, child] of Object.entries(record)) {
    if (child && typeof child === 'object') {
      const childRecord = child as Record<string, unknown>
      const childOrder = orderFromRecord(childRecord, '')
      if (childOrder) {
        out.push(childOrder)
        continue
      }
      if (looksLikeReference(key)) {
        const withKey = orderFromRecord(childRecord, key)
        if (withKey) out.push(withKey)
        continue
      }
      collectOrders(child, out)
      continue
    }
    if (typeof child === 'string' && looksLikeReference(child) && !['status', 'state', 'message'].includes(key)) out.push({ orderNumber: child })
  }
}

const readOrders = (): StoredOrder[] => {
  if (typeof window === 'undefined') return []
  const collected: StoredOrder[] = []
  for (const key of ORDER_KEYS) {
    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) continue
      collectOrders(JSON.parse(raw), collected)
    } catch {
      continue
    }
  }
  const seen = new Set<string>()
  return collected.filter((order) => {
    const id = order.orderNumber.toLowerCase()
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

const rememberOrder = (order: StoredOrder): void => {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem('stv-orders')
    const existing: StoredOrder[] = []
    if (raw) collectOrders(JSON.parse(raw), existing)
    const next = [order, ...existing.filter((item) => item.orderNumber.toLowerCase() !== order.orderNumber.toLowerCase())].slice(0, 12)
    window.localStorage.setItem('stv-orders', JSON.stringify(next))
  } catch {
    return
  }
}

const findOrder = (orders: StoredOrder[], number: string): StoredOrder | undefined => {
  const needle = number.trim().toLowerCase()
  if (!needle) return undefined
  return orders.find((order) => order.orderNumber.trim().toLowerCase() === needle)
}

const statusIndex = (status?: string): number => {
  const value = normalizeArabic(status || '')
  if (!value) return 0
  if (value === 'contacted') return 1
  if (value === 'shipped') return 3
  if (value === 'done' || value === 'delivered') return 4
  if (value.includes('الغ') || value.includes('ملغي') || value.includes('cancel')) return -1
  if (value.includes('طريق') || value.includes('شحن') || value.includes('قيد التوصيل') || value.includes('ship') || value.includes('dispatch')) return 3
  if (value.includes('تسليم') || value.includes('توصيل') || value.includes('وصل') || value.includes('deliver')) return 4
  if (value.includes('تجهيز') || value.includes('جاهز') || value.includes('pack') || value.includes('prepare')) return 2
  if (value.includes('راجع') || value.includes('تأكيد') || value.includes('review') || value.includes('pending') || value.includes('confirm') || value.includes('contact')) return 1
  return 0
}

const formatDate = (value: string, locale = 'ar-IQ'): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return date.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return value
  }
}
function OrderStatusPanel({ order }: { order: StoredOrder }) {
  const { t, lang } = useT()
  const index = statusIndex(order.status)
  const cancelled = index < 0
  const step = cancelled ? 0 : index
  const rawStatus = order.status || ''
  const labelKey = STATUS_LABEL_KEYS[rawStatus]
  const statusLabel = !cancelled
    ? (/^[\x20-\x7E]+$/.test(rawStatus) ? t(statusSteps[step]) : (labelKey ? t(labelKey) : (rawStatus || t(statusSteps[step]))))
    : ''
  return (
    <section className="status-panel glass-dark" aria-label={t('track.panelAria')}>
      <div className="status-head">
        <span>{cancelled ? t('track.statusTitle') : t('track.lastUpdate')}</span>
        <strong>{cancelled ? t('track.cancelled') : statusLabel}</strong>
        {order.createdAt && <small>{t('track.registeredAt')}: {formatDate(order.createdAt, lang === 'en' ? 'en-US' : 'ar-IQ')}</small>}
      </div>
      <ol className="status-steps">
        {statusSteps.map((label, position) => (
          <li key={label} className={!cancelled && position <= step ? 'is-done' : undefined}>
            <span>{!cancelled && position <= step ? <Check size={14} /> : position + 1}</span>
            <div>
              <strong>{t(label)}</strong>
              <small>{!cancelled && position < step ? t('track.stepDone') : !cancelled && position === step ? t('track.stepCurrent') : t('track.stepLater')}</small>
            </div>
          </li>
        ))}
      </ol>
      {order.items && order.items.length > 0 && (
        <div className="status-items">
          <span>{t('track.itemsTitle')}</span>
          {order.items.map((item, position) => (
            <div className="status-item" key={`${item.name}-${position}`}>
              <b>{item.name}{item.color ? ` · ${item.color}` : ''}</b>
              <span>{item.quantity ? `${item.quantity} ${t('pd.unitMeters')}` : ''}{item.total ? ` · ${formatPrice(item.total)}` : ''}</span>
            </div>
          ))}
        </div>
      )}
      <div className="order-meta">
        {order.total !== undefined && <span className="chip chip-dark">{t('track.total')}: {formatPrice(order.total)}</span>}
        {order.customerName && <span className="chip chip-dark">{order.customerName}</span>}
        {order.address && <span className="chip chip-dark">{order.address}</span>}
      </div>
    </section>
  )
}

export function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  const { t } = useT()
  const trimmed = orderNumber.trim()
  const [copied, setCopied] = useState(false)
  const orders = useMemo(readOrders, [])
  const stored = useMemo(() => (trimmed ? findOrder(orders, trimmed) : undefined), [orders, trimmed])
  const fallback = useMemo<StoredOrder | undefined>(() => (trimmed ? { orderNumber: trimmed, createdAt: new Date().toISOString(), status: statusSteps[0] } : undefined), [trimmed])
  const order = stored || fallback

  useEffect(() => {
    if (!trimmed || stored || !fallback) return undefined
    rememberOrder(fallback)
    return undefined
  }, [trimmed, stored, fallback])

  if (!order) {
    return (
      <>
        <GlassStyles />
        <main className="container-stv confirmation-page">
          <section className="order-empty glass">
            <div className="empty-icon"><PackageCheck size={25} /></div>
            <h1>{t('confirm.emptyTitle')}</h1>
            <p>{t('confirm.emptyText')}</p>
            <div className="empty-actions">
              <Link href="/order-tracking" className="button button-primary">{t('confirm.track')} <ArrowLeft size={16} /></Link>
              <Link href="/contact" className="button button-outline"><MessageCircle size={16} />{t('confirm.ask')}</Link>
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv confirmation-page">
        <div className="glass glass-card confirmation-panel">
          <div className="confirmation-mark"><Check size={30} /></div>
          <span className="eyebrow">{t('confirm.eyebrow')}</span>
          <h1>{t('confirm.title')}</h1>
          <p>{t('confirm.text')}</p>
          <div className="confirmation-number">
            <small>{t('confirm.orderNumber')}</small>
            <div className="order-number-row">
              <strong dir="ltr">{order.orderNumber}</strong>
              <button
                type="button"
                className={`copy-number${copied ? ' is-copied' : ''}`}
                onClick={async () => {
                  const text = order.orderNumber
                  let ok = false
                  try {
                    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true }
                  } catch { ok = false }
                  if (!ok) {
                    const ta = document.createElement('textarea')
                    ta.value = text
                    ta.setAttribute('readonly', '')
                    ta.style.position = 'fixed'
                    ta.style.opacity = '0'
                    document.body.appendChild(ta)
                    ta.select()
                    try { ok = document.execCommand('copy') } catch { ok = false }
                    document.body.removeChild(ta)
                  }
                  if (ok) {
                    setCopied(true)
                    window.setTimeout(() => setCopied(false), 2200)
                  }
                }}
                aria-label={t('confirm.copy')}
              >
                {copied
                  ? <><Check size={15} strokeWidth={2.6} /> {t('confirm.copied')}</>
                  : <><CopyIcon size={15} strokeWidth={2.4} /> {t('confirm.copy')}</>}
              </button>
            </div>
          </div>
          <OrderStatusPanel order={order} />
          <div className="confirmation-actions">
            <Link href="/catalog" className="button button-primary">{t('confirm.continue')} <ArrowLeft size={16} /></Link>
            <Link href={`/order-tracking?order=${encodeURIComponent(order.orderNumber)}`} className="button button-outline"><Search size={16} />{t('confirm.track')}</Link>
            <Link href={`/order-tracking?order=${encodeURIComponent(order.orderNumber)}`} className="button button-outline"><PackageCheck size={16} />{t('confirm.trackStatus')}</Link>
          </div>
          <div className="confirmation-trust"><Truck size={17} /><span>{t('confirm.trust')}</span></div>
        </div>
      </main>
    </>
  )
}

export function OrderTrackingPage() {
  const { t } = useT()
  const [, navigate] = useLocation()
  const browserSearch = useSearch()
  const query = new URLSearchParams(browserSearch)
  const currentOrder = query.get('order') || ''
  const [value, setValue] = useState(currentOrder)
  const [submitted, setSubmitted] = useState(currentOrder)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const orders = useMemo(readOrders, [version])
  const [remote, setRemote] = useState<{ status: string; createdAt?: string } | null>(null)
  const [remoteState, setRemoteState] = useState<'idle' | 'loading' | 'ok' | 'missing' | 'error'>('idle')

  useEffect(() => {
    if (!currentOrder) return undefined
    setValue(currentOrder)
    setSubmitted(currentOrder)
    return undefined
  }, [currentOrder])

  const active = submitted || currentOrder
  const match = active ? findOrder(orders, active) : undefined

  useEffect(() => {
    if (!active) {
      setRemote(null)
      setRemoteState('idle')
      return undefined
    }
    let cancelled = false
    setRemoteState('loading')
    fetch(apiUrl(`/api/orders/${encodeURIComponent(active)}`), { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (cancelled) return
        if (response.status === 404) {
          setRemote(null)
          setRemoteState('missing')
          return
        }
        if (!response.ok) {
          setRemote(null)
          setRemoteState('error')
          return
        }
        const body = (await response.json().catch(() => null)) as { data?: { status?: string; created_at?: string } } | null
        const data = body?.data
        if (!data?.status) {
          setRemote(null)
          setRemoteState('missing')
          return
        }
        setRemote({ status: data.status, createdAt: data.created_at || undefined })
        setRemoteState('ok')
      })
      .catch(() => {
        if (cancelled) return
        setRemote(null)
        setRemoteState('error')
      })
    return () => {
      cancelled = true
    }
  }, [active, version])

  const displayed: StoredOrder | undefined = active
    ? remote && remote.status
      ? { ...(match ?? { orderNumber: active }), status: remote.status, createdAt: remote.createdAt || match?.createdAt }
      : match
    : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = value.trim()
    if (!clean) {
      setError(t('track.errorEmpty'))
      return
    }
    setError('')
    setSubmitted(clean)
    navigate(`/order-tracking?order=${encodeURIComponent(clean)}`)
  }

  return (
    <>
      <GlassStyles />
      <main className="container-stv info-page">
        <div className="breadcrumbs"><Link href="/">{t('track.crumbHome')}</Link><span>›</span><span>{t('track.crumbCurrent')}</span></div>

        <section className="tracking-card glass">
          <div className="tracking-icon"><PackageCheck size={28} /></div>
          <span className="eyebrow">{t('track.eyebrow')}</span>
          <h1>{t('track.title')}</h1>
          <p>{t('track.intro')}</p>

          <form className="tracking-form" onSubmit={submit} noValidate>
            <label className="sr-only" htmlFor="tracking-order">{t('track.inputLabel')}</label>
            <Search size={18} />
            <input id="tracking-order" value={value} onChange={(event) => setValue(event.target.value)} placeholder={t('track.placeholder')} dir="ltr" aria-invalid={Boolean(error)} aria-describedby={error ? 'tracking-error' : undefined} />
            <button type="submit" className="button button-primary">{t('track.submit')}</button>
          </form>

          {error && <p className="field-error" id="tracking-error" role="alert">{error}</p>}

          {active && remoteState === 'loading' && !displayed && (
            <div className="tracking-result-glass" role="status">
              <Search size={18} />
              <div><strong>{t('track.loading')}</strong></div>
            </div>
          )}

          {active && displayed && (
            <>
              <OrderStatusPanel order={displayed} />
              <div className="local-orders">
                <span>{t('track.searchedFor')}</span>
                <span className="chip" dir="ltr">{displayed.orderNumber}</span>
                <button type="button" className="chip" onClick={() => setVersion((current) => current + 1)}><RotateCcw size={13} />{t('track.refresh')}</button>
                {remoteState === 'ok' && <span className="chip">{t('track.synced')}</span>}
              </div>
            </>
          )}

          {active && !displayed && remoteState !== 'loading' && (
            <div className="tracking-result-glass form-status-error" role="status">
              <Search size={18} />
              <div>
                <strong>{remoteState === 'error' ? t('track.remoteError').replace('{order}', active) : t('track.notFound').replace('{order}', active)}</strong>
                <p>{t('track.notFoundHint')}</p>
              </div>
            </div>
          )}

          {!active && orders.length === 0 && (
            <section className="order-empty glass">
              <div className="empty-icon"><Search size={25} /></div>
              <h1>{t('track.emptyTitle')}</h1>
              <p>{t('track.emptyText')}</p>
              <div className="empty-actions">
                <Link href="/catalog" className="button button-primary">{t('track.browse')} <ArrowLeft size={16} /></Link>
                <Link href="/contact" className="button button-outline">{t('track.contact')} <ArrowLeft size={16} /></Link>
              </div>
            </section>
          )}

          {!active && orders.length > 0 && (
            <div className="local-orders">
              <span>{t('track.localOrders')}</span>
              {orders.slice(0, 5).map((order) => (
                <button type="button" key={order.orderNumber} className="chip" dir="ltr" onClick={() => { setValue(order.orderNumber); setSubmitted(order.orderNumber); setError('') }}>{order.orderNumber}</button>
              ))}
            </div>
          )}

          <Link href="/contact" className="button button-outline"><MessageCircle size={16} />{t('track.askButton')}</Link>
        </section>
      </main>
    </>
  )
}
