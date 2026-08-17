// BookingFlow.jsx — Noble Vet Clinics
// Booking flow: Clinic → Service → Vet → Time → Details → Personal → Pet → Summary
// Account portal: sidebar dashboard (Home / Book / My pets / Account)

import { useState, useEffect, Fragment } from "react"

const API_BASE = "https://noble-booking-api.vercel.app"
const CLINIC_PHONE = "+971600566253"
const CLINIC_PHONE_DISPLAY = "+971 600 566 253"
const CLINIC_WHATSAPP = "https://wa.me/971600566253"

const T = {
    blue: "#2465B4",
    blueDeep: "#173F70",
    blueWash: "#EAF1FA",
    cream: "#F9F4ED",
    ink: "#14171C",
    muted: "#6B7280",
    line: "#E4E8ED",
    urgent: "#A3341F",
    urgentWash: "#FBEDE9",
    ok: "#1F7A4C",
    okWash: "#EDF7F1",
    okLine: "#CDE7D9",
    amber: "#8A6A1F",
    amberWash: "#FDF6E7",
    amberLine: "#EFE0BC",
    white: "#FFFFFF",
}

const serif = "'Instrument Serif', Georgia, serif"
const sans = "'DM Sans', 'Helvetica Neue', sans-serif"

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap');
  .nvc-wrap *, .nvc-wrap *::before, .nvc-wrap *::after { box-sizing: border-box; }
  .nvc-wrap { font-family: ${sans}; background: #F4F6F9; min-height: 100vh; color: ${T.ink}; font-size: 16px; line-height: 1.55; }
  .nvc-wrap button { font: inherit; cursor: pointer; }
  .nvc-shell { max-width: 900px; margin: 0 auto; padding: 32px 24px 110px; }

  /* ── Buttons ─────────────────────────────────────────────────────────── */
  .nvc-btn { display: inline-flex; align-items: center; justify-content: center; gap: 9px; background: ${T.blue}; color: #fff; padding: 14px 28px; border-radius: 999px; font-size: 15.5px; font-weight: 500; border: none; }
  .nvc-btn:hover { background: ${T.blueDeep}; }
  .nvc-btn.full { width: 100%; }
  .nvc-btn.out { background: #fff; color: ${T.blue}; border: 1.5px solid ${T.blue}; }
  .nvc-btn.out:hover { background: ${T.blueWash}; }
  .nvc-btn.sm { padding: 11px 20px; font-size: 14.5px; }
  .nvc-btn:disabled { opacity: .4; pointer-events: none; }

  /* ── Stepper (thin progress bar) ─────────────────────────────────────── */
  .nvc-steps { display: flex; gap: 8px; margin-bottom: 22px; max-width: 620px; }
  .nvc-steps i { flex: 1; height: 4px; border-radius: 2px; background: ${T.line}; }
  .nvc-steps i.on { background: ${T.blue}; }

  /* ── Headings ────────────────────────────────────────────────────────── */
  .nvc-h1 { font-family: ${serif}; font-weight: 400; font-size: 30px; color: ${T.ink}; margin-bottom: 6px; }
  .nvc-h1-sub { font-size: 15px; color: ${T.muted}; margin: 0 0 24px; }
  .nvc-wrap .nvc-h1-center { text-align: center; }
  .nvc-wrap .nvc-h1-sub-center { text-align: center; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.6; }

  /* ── Option cards (clinic / service / vet) ──────────────────────────── */
  .nvc-optgrid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; max-width: 760px; margin-bottom: 24px; }
  @media(max-width: 760px) { .nvc-optgrid { grid-template-columns: 1fr; } }
  .nvc-opt { display: flex; align-items: center; gap: 14px; border: 1.5px solid ${T.line}; border-radius: 14px; padding: 16px; background: #fff; width: 100%; text-align: left; position: relative; }
  .nvc-opt:hover { border-color: ${T.blue}; }
  .nvc-opt.sel { border-color: ${T.blue}; background: ${T.blueWash}; }
  .nvc-opt .nvc-opt-ic { width: 42px; height: 42px; border-radius: 12px; background: ${T.cream}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 19px; overflow: hidden; }
  .nvc-opt .nvc-opt-ic img { width: 100%; height: 100%; object-fit: cover; }
  .nvc-opt.vopt .nvc-opt-ic { border-radius: 50%; background: ${T.blueWash}; font-family: ${serif}; font-size: 16px; color: ${T.blue}; }
  .nvc-opt-tx { flex: 1; min-width: 0; }
  .nvc-opt-tx b { display: block; font-size: 15.5px; font-weight: 500; line-height: 1.3; color: ${T.ink}; }
  .nvc-opt-tx span { font-size: 13px; color: ${T.muted}; display: block; }
  .nvc-opt-tx small { font-size: 12.5px; color: ${T.ok}; font-weight: 500; display: block; margin-top: 1px; }
  .nvc-opt-tick { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid ${T.line}; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #fff; }
  .nvc-opt.sel .nvc-opt-tick { background: ${T.blue}; border-color: ${T.blue}; }
  .nvc-opt-tick svg { width: 11px; height: 11px; color: #fff; opacity: 0; }
  .nvc-opt.sel .nvc-opt-tick svg { opacity: 1; }
  .nvc-b24 { font-size: 9.5px; letter-spacing: .09em; text-transform: uppercase; font-weight: 600; background: ${T.ink}; color: #fff; padding: 2px 8px; border-radius: 999px; margin-left: 7px; vertical-align: 1px; }

  /* ── Time step ───────────────────────────────────────────────────────── */
  .nvc-timewrap { display: grid; grid-template-columns: 1.4fr 1fr; gap: 26px; align-items: start; max-width: 880px; }
  @media(max-width: 860px) { .nvc-timewrap { grid-template-columns: 1fr; } }
  .nvc-days { display: flex; gap: 9px; overflow-x: auto; padding-bottom: 16px; }
  .nvc-day { flex: none; width: 62px; border: 1.5px solid ${T.line}; border-radius: 13px; padding: 11px 0; text-align: center; background: #fff; }
  .nvc-day.sel { border-color: ${T.blue}; background: ${T.blue}; color: #fff; }
  .nvc-day small { display: block; font-size: 11px; opacity: .7; }
  .nvc-day b { display: block; font-size: 17px; font-weight: 500; }
  .nvc-slots { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; }
  @media(max-width: 560px) { .nvc-slots { grid-template-columns: repeat(3, 1fr); } }
  .nvc-slotbtn { border: 1.5px solid ${T.line}; border-radius: 12px; padding: 13px 0; text-align: center; font-size: 14.5px; font-weight: 500; background: #fff; color: ${T.ink}; }
  .nvc-slotbtn:hover { border-color: ${T.blue}; }
  .nvc-slotbtn.sel { border-color: ${T.blue}; background: ${T.blue}; color: #fff; }

  /* ── Panels / cards ──────────────────────────────────────────────────── */
  .nvc-panel { background: #fff; border: 1px solid ${T.line}; border-radius: 16px; padding: 24px 26px 26px; }
  .nvc-panel h3 { font-size: 17px; font-weight: 500; margin: 0 0 16px; color: ${T.ink}; }

  /* ── Summary (used on Time step + final review) ─────────────────────── */
  .nvc-sum { background: #fff; border: 1px solid ${T.line}; border-radius: 16px; padding: 6px 20px; }
  .nvc-sum .r { display: flex; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid ${T.line}; font-size: 14.5px; }
  .nvc-sum .r:last-child { border-bottom: none; }
  .nvc-sum .r span { color: ${T.muted}; }
  .nvc-sum .r b { font-weight: 500; text-align: right; }

  /* ── Forms ───────────────────────────────────────────────────────────── */
  .nvc-form-wrap { max-width: 460px; margin: 0 auto 24px; }
  .nvc-form-field { margin-bottom: 16px; }
  .nvc-form-field label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 7px; color: ${T.ink}; }
  .nvc-input { width: 100%; border: 1.5px solid ${T.line}; border-radius: 12px; padding: 13px 15px; font-size: 15px; background: #fff; font-family: ${sans}; color: ${T.ink}; outline: none; }
  .nvc-input:focus { border-color: ${T.blue}; }
  .nvc-input.error { border-color: ${T.urgent}; }
  .nvc-error-text { font-size: 12.5px; color: ${T.urgent}; margin-top: 6px; }
  textarea.nvc-input { resize: vertical; min-height: 90px; }
  .nvc-form-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media(max-width: 560px) { .nvc-form-grid2 { grid-template-columns: 1fr; } }
  .nvc-divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; }
  .nvc-divider-line { flex: 1; height: 1px; background: ${T.line}; }
  .nvc-divider-text { font-size: 10px; color: ${T.muted}; text-transform: uppercase; letter-spacing: .1em; white-space: nowrap; }

  /* ── Pet chip cards (booking flow pet step) ─────────────────────────── */
  .nvc-petchips { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; justify-content: center; }
  .nvc-petchip { display: flex; align-items: center; gap: 10px; padding: 12px 18px; border: 1.5px solid ${T.line}; border-radius: 12px; cursor: pointer; background: #fff; }
  .nvc-petchip:hover { border-color: ${T.blue}; }
  .nvc-petchip.sel { border-color: ${T.blue}; background: ${T.blueWash}; }
  .nvc-addpet { display: flex; align-items: center; gap: 8px; padding: 12px 18px; border: 1.5px dashed ${T.line}; border-radius: 12px; cursor: pointer; color: ${T.blue}; font-size: 13px; font-weight: 600; background: #fff; margin: 0 auto 20px; width: fit-content; }

  /* ── Nav row (fixed bottom, booking wizard) ─────────────────────────── */
  .nvc-navrow { position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid ${T.line}; padding: 16px 32px; display: flex; justify-content: space-between; align-items: center; z-index: 100; box-shadow: 0 -4px 16px rgba(0,0,0,.06); }
  .nvc-navrow-inner { display: flex; justify-content: space-between; align-items: center; max-width: 900px; margin: 0 auto; width: 100%; }
  @media(max-width: 700px) { .nvc-navrow { padding: 12px 16px; } }

  /* ── Success screen ──────────────────────────────────────────────────── */
  .nvc-done { max-width: 560px; text-align: center; margin: 40px auto 0; padding: 0 20px; }
  .nvc-done .ring { width: 88px; height: 88px; border-radius: 50%; background: ${T.okWash}; border: 2px solid ${T.okLine}; margin: 0 auto 22px; display: flex; align-items: center; justify-content: center; }
  .nvc-done .ring svg { width: 40px; height: 40px; color: ${T.ok}; }
  .nvc-done h2 { font-family: ${serif}; font-weight: 400; font-size: 32px; margin-bottom: 10px; }
  .nvc-done p { color: ${T.muted}; font-size: 16px; margin: 0 auto 26px; max-width: 38ch; }
  .nvc-refbox { background: ${T.cream}; border-radius: 12px; padding: 14px 24px; margin: 18px 0; }
  .nvc-ref-label { font-size: 10px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: .14em; margin-bottom: 4px; }
  .nvc-ref-code { font-family: 'Courier New', monospace; font-size: 22px; font-weight: 700; color: ${T.ink}; letter-spacing: .12em; }

  .nvc-loading-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 14px; }
  .nvc-spinner { width: 36px; height: 36px; border: 3px solid ${T.blueWash}; border-top-color: ${T.blue}; border-radius: 50%; animation: nvc-spin .8s linear infinite; }
  @keyframes nvc-spin { to { transform: rotate(360deg); } }

  /* ── Login splash ────────────────────────────────────────────────────── */
  .nvc-auth { min-height: 100vh; display: grid; grid-template-columns: 1.05fr .95fr; }
  @media(max-width: 900px) { .nvc-auth { grid-template-columns: 1fr; } .nvc-auth .nvc-auth-side { display: none; } }
  .nvc-auth-side { background: ${T.ink}; color: #fff; padding: 56px 60px; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; }
  .nvc-auth-side::after { content: ""; position: absolute; inset: 0; background: radial-gradient(110% 70% at 78% 18%, rgba(36,101,180,.36), transparent 62%); }
  .nvc-auth-side > * { position: relative; z-index: 2; }
  .nvc-auth-logo { font-family: ${serif}; font-size: 30px; color: #fff; }
  .nvc-auth-side h1 { font-family: ${serif}; font-weight: 400; font-size: clamp(30px,3.2vw,44px); line-height: 1.08; margin: 26px 0 18px; max-width: 16ch; }
  .nvc-auth-side p { color: rgba(255,255,255,.72); font-size: 17px; max-width: 42ch; margin: 0; }
  .nvc-auth-side ul { list-style: none; margin: 30px 0 0; padding: 0; }
  .nvc-auth-side li { display: flex; gap: 13px; padding: 10px 0; font-size: 15px; color: rgba(255,255,255,.86); }
  .nvc-auth-side li svg { width: 16px; height: 16px; color: #8FB4E0; flex-shrink: 0; margin-top: 4px; }
  .nvc-auth-side small { font-size: 12.5px; color: rgba(255,255,255,.45); }
  .nvc-auth-panel { display: flex; align-items: center; justify-content: center; padding: 40px 28px; background: linear-gradient(180deg, ${T.cream} 0%, #F4F6F9 100%); }
  .nvc-auth-card { width: 100%; max-width: 420px; }
  .nvc-auth-card h2 { font-family: ${serif}; font-weight: 400; font-size: 29px; margin-bottom: 8px; }
  .nvc-auth-card .sub { color: ${T.muted}; font-size: 15px; margin: 0 0 24px; }
  .nvc-auth-check { display: flex; align-items: flex-start; gap: 10px; margin: 14px 0; font-size: 12.5px; color: ${T.muted}; line-height: 1.5; }
  .nvc-auth-fine { font-size: 13px; color: ${T.muted}; margin-top: 16px; text-align: center; line-height: 1.6; }
  .nvc-auth-fine a { color: ${T.blue}; font-weight: 500; }

  /* ── App shell (sidebar + main) ──────────────────────────────────────── */
  .nvc-app { display: grid; grid-template-columns: 250px 1fr; min-height: 100vh; background: #F4F6F9; }
  @media(max-width: 960px) { .nvc-app { grid-template-columns: 1fr; } .nvc-side { display: none; } }
  .nvc-side { background: #fff; border-right: 1px solid ${T.line}; padding: 26px 18px; display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; }
  .nvc-side-logo { font-family: ${serif}; font-size: 22px; margin: 0 8px 26px; color: ${T.ink}; }
  .nvc-side nav { display: flex; flex-direction: column; gap: 3px; flex: 1; }
  .nvc-side nav button { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 11px; font-size: 15px; color: ${T.muted}; width: 100%; text-align: left; background: none; border: none; }
  .nvc-side nav button svg { width: 18px; height: 18px; flex-shrink: 0; }
  .nvc-side nav button:hover { background: #F7F9FB; color: ${T.ink}; }
  .nvc-side nav button.on { background: ${T.blueWash}; color: ${T.blue}; font-weight: 500; }
  .nvc-side-em { border: 1px solid #F0D8D1; background: ${T.urgentWash}; border-radius: 13px; padding: 14px; margin-bottom: 12px; }
  .nvc-side-em b { display: flex; align-items: center; gap: 8px; font-size: 13px; color: ${T.urgent}; font-weight: 500; margin-bottom: 4px; }
  .nvc-side-em .dot { width: 6px; height: 6px; border-radius: 50%; background: ${T.urgent}; display: inline-block; animation: nvc-pulse 2s ease-in-out infinite; }
  @keyframes nvc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
  .nvc-side-em span { font-size: 12px; color: #7A3E2C; display: block; margin-bottom: 9px; }
  .nvc-side-em a { display: block; text-align: center; background: ${T.urgent}; color: #fff; padding: 9px; border-radius: 999px; font-size: 13px; font-weight: 600; }
  .nvc-side-me { display: flex; align-items: center; gap: 11px; padding: 11px 8px; border-top: 1px solid ${T.line}; }
  .nvc-side-me .av { width: 34px; height: 34px; border-radius: 50%; background: ${T.blueWash}; display: flex; align-items: center; justify-content: center; font-family: ${serif}; font-size: 14px; color: ${T.blue}; flex-shrink: 0; }
  .nvc-side-me b { display: block; font-size: 14px; font-weight: 500; }
  .nvc-side-me span { font-size: 12px; color: ${T.muted}; }

  /* ── Mobile app header (logo / back+title, call icon) ─────────────────── */
  .nvc-mheader { display: none; }
  @media(max-width: 960px) {
    .nvc-mheader { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: 0; z-index: 30; background: #fff; border-bottom: 1px solid ${T.line}; padding: 14px 18px; }
    .nvc-mheader .logo { font-family: ${serif}; font-size: 21px; color: ${T.ink}; }
    .nvc-mheader .back { display: flex; align-items: center; gap: 6px; background: none; border: none; font-size: 16px; font-weight: 500; color: ${T.ink}; padding: 0; }
    .nvc-mheader .back svg { width: 20px; height: 20px; }
    .nvc-mheader .call { width: 36px; height: 36px; border-radius: 50%; border: 1px solid ${T.line}; display: flex; align-items: center; justify-content: center; color: ${T.urgent}; flex-shrink: 0; }
    .nvc-mheader .call svg { width: 16px; height: 16px; }
  }

  /* ── Mobile bottom tab bar ──────────────────────────────────────────────── */
  .nvc-bottomtabs { display: none; }
  @media(max-width: 960px) {
    .nvc-bottomtabs { display: flex; position: fixed; bottom: 0; left: 0; right: 0; background: #fff; border-top: 1px solid ${T.line}; padding: 8px 6px calc(10px + env(safe-area-inset-bottom)); z-index: 30; }
    .nvc-bottomtabs button { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10.5px; color: ${T.muted}; background: none; border: none; padding: 4px; }
    .nvc-bottomtabs button svg { width: 21px; height: 21px; }
    .nvc-bottomtabs button.on { color: ${T.blue}; font-weight: 500; }
    .nvc-main { padding-bottom: 92px; }
  }

  /* ── Mobile-only quick-action tiles (Home) ──────────────────────────────── */
  .nvc-quickgrid { display: none; }
  @media(max-width: 960px) { .nvc-quickgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-bottom: 20px; } }
  .nvc-quicktile { display: flex; align-items: center; gap: 10px; border: 1px solid ${T.line}; border-radius: 15px; padding: 14px 13px; background: #fff; text-align: left; }
  .nvc-quicktile .ic { width: 33px; height: 33px; border-radius: 10px; background: ${T.blueWash}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .nvc-quicktile .ic svg { width: 16px; height: 16px; color: ${T.blue}; }
  .nvc-quicktile b { font-size: 14px; font-weight: 500; line-height: 1.25; }
  .nvc-quicktile.em { border-color: #F0D8D1; background: ${T.urgentWash}; }
  .nvc-quicktile.em .ic { background: #F6DDD6; }
  .nvc-quicktile.em .ic svg { color: ${T.urgent}; }
  .nvc-quicktile.em b { color: ${T.urgent}; }

  /* ── Mobile horizontal pet scroller (Home) ──────────────────────────────── */
  .nvc-petrow-mobile { display: none; }
  @media(max-width: 960px) {
    .nvc-petrow-mobile { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; margin-bottom: 16px; }
    .nvc-petrow-mobile .nvc-pcard { flex: 0 0 112px; }
    .nvc-home-petgrid { display: none; }
  }

  /* ── Mobile row-list variant for "My pets" (matches .nvc-opt styling) ──── */
  .nvc-petrows-mobile { display: flex; flex-direction: column; gap: 10px; }

  .nvc-main { padding: 34px 40px 60px; max-width: 1080px; }
  @media(max-width: 700px) { .nvc-main { padding: 22px 18px 50px; } }
  .nvc-phead { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 26px; flex-wrap: wrap; }
  .nvc-phead h1 { font-family: ${serif}; font-weight: 400; font-size: 32px; margin: 0; color: ${T.ink}; }
  .nvc-phead p { color: ${T.muted}; font-size: 15px; margin: 4px 0 0; }

  .nvc-grid2 { display: grid; grid-template-columns: 1.35fr 1fr; gap: 22px; align-items: start; }
  @media(max-width: 900px) { .nvc-grid2 { grid-template-columns: 1fr; } }

  .nvc-nextcard { background: ${T.blue}; color: #fff; border-radius: 16px; padding: 26px 28px; }
  .nvc-nextcard .t { display: flex; align-items: center; gap: 9px; font-size: 11px; letter-spacing: .13em; text-transform: uppercase; opacity: .85; margin-bottom: 12px; }
  .nvc-nextcard .t svg { width: 13px; height: 13px; }
  .nvc-nextcard b { display: block; font-family: ${serif}; font-weight: 400; font-size: 25px; margin-bottom: 6px; }
  .nvc-nextcard span { display: block; font-size: 14.5px; opacity: .9; }
  .nvc-nextcard .acts { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .nvc-nextcard .acts button, .nvc-nextcard .acts a { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 999px; font-size: 13.5px; font-weight: 500; background: rgba(255,255,255,.18); color: #fff; border: none; text-decoration: none; cursor: pointer; }
  .nvc-nextcard .acts button:hover, .nvc-nextcard .acts a:hover { background: rgba(255,255,255,.28); }
  .nvc-nextcard .acts button.w, .nvc-nextcard .acts a.w { background: #fff; color: ${T.blue}; }
  .nvc-nextcard .acts button.w:hover, .nvc-nextcard .acts a.w:hover { background: ${T.blueWash}; }
  .nvc-nextcard .acts button:disabled { opacity: .5; pointer-events: none; }

  .nvc-petgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  @media(max-width: 760px) { .nvc-petgrid { grid-template-columns: 1fr 1fr; } }
  .nvc-pcard { border: 1px solid ${T.line}; border-radius: 14px; padding: 18px 16px; text-align: center; background: #fff; width: 100%; }
  .nvc-pcard:hover { border-color: ${T.blue}; }
  .nvc-pcard .av { width: 54px; height: 54px; border-radius: 50%; background: ${T.cream}; margin: 0 auto 10px; display: flex; align-items: center; justify-content: center; font-size: 25px; object-fit: cover; overflow: hidden; }
  .nvc-pcard .av img { width: 100%; height: 100%; object-fit: cover; }
  .nvc-pcard b { display: block; font-size: 15px; font-weight: 500; }
  .nvc-pcard span { font-size: 12.5px; color: ${T.muted}; }
  .nvc-pcard.add { border-style: dashed; color: ${T.blue}; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; min-height: 130px; }

  .nvc-hrow { display: flex; gap: 16px; padding: 15px 0; border-bottom: 1px solid ${T.line}; align-items: center; width: 100%; text-align: left; background: none; border-left: none; border-right: none; border-top: none; }
  .nvc-hrow:last-child { border-bottom: none; }
  .nvc-hrow .dt { flex: none; width: 62px; }
  .nvc-hrow .dt b { display: block; font-size: 14.5px; font-weight: 500; }
  .nvc-hrow .dt small { font-size: 11.5px; color: ${T.muted}; }
  .nvc-hrow .tx { flex: 1; min-width: 0; }
  .nvc-hrow .tx b { display: block; font-size: 15px; font-weight: 500; margin-bottom: 2px; }
  .nvc-hrow .tx span { font-size: 13px; color: ${T.muted}; display: block; }
  .nvc-hrow .ar svg { width: 15px; height: 15px; color: ${T.muted}; }

  /* ── Pet profile ─────────────────────────────────────────────────────── */
  .nvc-pettop { display: grid; grid-template-columns: auto 1fr; gap: 26px; align-items: center; background: ${T.cream}; border-radius: 16px; padding: 28px 30px; margin-bottom: 24px; }
  @media(max-width: 620px) { .nvc-pettop { grid-template-columns: 1fr; text-align: center; } }
  .nvc-pettop .av { width: 96px; height: 96px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 44px; overflow: hidden; margin: 0 auto; }
  .nvc-pettop .av img { width: 100%; height: 100%; object-fit: cover; }
  .nvc-pettop h1 { font-family: ${serif}; font-weight: 400; font-size: 32px; margin-bottom: 4px; }
  .nvc-pettop p { color: ${T.muted}; font-size: 15px; margin: 0 0 12px; }
  .nvc-chips { display: flex; gap: 7px; flex-wrap: wrap; }
  @media(max-width: 620px) { .nvc-chips { justify-content: center; } }
  .nvc-chips span { font-size: 12.5px; background: #fff; border: 1px solid ${T.line}; padding: 5px 13px; border-radius: 999px; color: ${T.muted}; }

  .nvc-due { border-radius: 14px; padding: 4px 20px; margin-bottom: 24px; }
  .nvc-due.ok { background: ${T.okWash}; border: 1px solid ${T.okLine}; }
  .nvc-due.warn { background: ${T.amberWash}; border: 1px solid ${T.amberLine}; }
  .nvc-due .r { display: flex; justify-content: space-between; align-items: center; padding: 13px 0; border-bottom: 1px solid ${T.okLine}; font-size: 14.5px; }
  .nvc-due.warn .r { border-bottom-color: ${T.amberLine}; }
  .nvc-due .r:last-child { border-bottom: none; }
  .nvc-due b { font-weight: 500; display: block; }
  .nvc-due small { font-size: 13px; color: ${T.muted}; }
  .nvc-due .st { font-size: 13.5px; font-weight: 500; color: ${T.ok}; }
  .nvc-due .st.w { color: ${T.amber}; }

  /* ── Consult detail ──────────────────────────────────────────────────── */
  .nvc-cgrid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 26px; align-items: start; }
  @media(max-width: 860px) { .nvc-cgrid { grid-template-columns: 1fr; } }
  .nvc-blk { margin-bottom: 24px; }
  .nvc-blk .bl { font-size: 11px; letter-spacing: .13em; text-transform: uppercase; color: ${T.blue}; font-weight: 500; margin: 0 0 8px; }
  .nvc-blk p { margin: 0; font-size: 15.5px; }

  /* ── Account settings rows ──────────────────────────────────────────── */
  .nvc-mrow { display: flex; align-items: center; gap: 14px; padding: 16px 0; border-bottom: 1px solid ${T.line}; width: 100%; text-align: left; background: none; border-left: none; border-right: none; border-top: none; }
  .nvc-mrow:last-child { border-bottom: none; }
  .nvc-mrow .ic { width: 38px; height: 38px; border-radius: 11px; background: ${T.blueWash}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .nvc-mrow .ic svg { width: 17px; height: 17px; color: ${T.blue}; }
  .nvc-mrow b { flex: 1; font-size: 15.5px; font-weight: 400; }
  .nvc-mrow .ar svg { width: 15px; height: 15px; color: ${T.muted}; }

  .nvc-portal-empty { text-align: center; color: ${T.muted}; padding: 30px 0; font-size: 14px; }

  /* ── Portal table (bookings, transactions) ────────────────────────────── */
  .nvc-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .nvc-table th { text-align: left; font-size: 11px; font-weight: 700; color: ${T.muted}; text-transform: uppercase; letter-spacing: .05em; padding: 10px 12px; border-bottom: 1.5px solid ${T.line}; }
  .nvc-table td { padding: 12px; font-size: 13px; color: ${T.ink}; border-bottom: 1px solid ${T.line}; }
  .nvc-table tr.clk { cursor: pointer; }
  .nvc-table tr.clk:hover { background: ${T.blueWash}; }
  .nvc-subtab { background: none; border: 1.5px solid transparent; padding: 9px 16px; border-radius: 999px; font-size: 14px; font-weight: 600; color: ${T.muted}; }
  .nvc-subtab:hover { background: ${T.blueWash}; color: ${T.ink}; }
  .nvc-subtab.on { background: ${T.ink}; color: #fff; }

  .nvc-fin-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
  @media(max-width: 700px) { .nvc-fin-cards { grid-template-columns: 1fr; } }
  .nvc-fin-card { background: ${T.cream}; border-radius: 12px; padding: 16px 18px; }
  .nvc-fin-label { font-size: 12px; color: ${T.muted}; margin-bottom: 6px; }
  .nvc-fin-value { font-size: 22px; font-weight: 700; color: ${T.ink}; }
  .nvc-pending-row { display: flex; justify-content: space-between; align-items: center; background: ${T.urgentWash}; border: 1px solid #F5C6C0; border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; }

  /* ── Pet-details mini grid (used inside pet profile hero) ─────────────── */
  .nvc-minigrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  @media(max-width: 620px) { .nvc-minigrid { grid-template-columns: 1fr 1fr; } }

  /* ── Modal ───────────────────────────────────────────────────────────── */
  .nvc-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 20px; }
  .nvc-modal { background: #fff; border-radius: 16px; padding: 32px; width: 100%; max-width: 460px; box-shadow: 0 20px 60px rgba(0,0,0,.2); max-height: 90vh; overflow-y: auto; }
  .nvc-modal-title { font-family: ${serif}; font-size: 22px; font-weight: 400; color: ${T.ink}; margin-bottom: 4px; }
  .nvc-modal-close { float: right; background: none; border: none; font-size: 20px; color: ${T.muted}; cursor: pointer; margin-top: -4px; }

  .nvc-toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 26px; background: ${T.ink}; color: #fff; padding: 13px 22px; border-radius: 999px; font-size: 14px; z-index: 999; box-shadow: 0 10px 30px rgba(0,0,0,.2); }
`

const STEPS = [
    { key: "clinic", label: "Clinic" },
    { key: "reason", label: "Service" },
    { key: "vet", label: "Vet" },
    { key: "time", label: "Time" },
    { key: "details", label: "Details" },
    { key: "personal", label: "Personal details" },
    { key: "pet", label: "Pet" },
    { key: "summary", label: "Summary" },
]

const EMOJI = { Dog: "🐕", Cat: "🐈", Rabbit: "🐇", Bird: "🦜", Other: "🐾" }
const REASON_ICONS = ["🩺", "💉", "🦷", "✂️", "👁️", "🔍"]
const isEmail = (v) => /\S+@\S+\.\S+/.test(v)
const isPhone = (v) => /^[+\d][\d\s\-().]{6,}$/.test(v)

function initials(name) {
    if (!name) return "?"
    return name
        .replace(/^Dr\.?\s*/i, "")
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase()
}

const CheckIcon = () => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
        <path d="M2.5 7.5 5.5 10.5 11.5 4" />
    </svg>
)
const ChevronIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="m9 6 6 6-6 6" />
    </svg>
)

function fmtDate(unixSeconds) {
    if (!unixSeconds) return "—"
    return new Date(unixSeconds * 1000).toLocaleDateString("en-AE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    })
}
function fmtTime(unixSeconds) {
    if (!unixSeconds) return ""
    return new Date(unixSeconds * 1000).toLocaleTimeString("en-AE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}

let toastTimer = null
function useToast() {
    const [toast, setToast] = useState("")
    const show = (msg) => {
        setToast(msg)
        clearTimeout(toastTimer)
        toastTimer = setTimeout(() => setToast(""), 2200)
    }
    return [toast, show]
}

// Tracks whether the viewport is at the mobile app-shell breakpoint, so the
// portal can swap in the phone-app layout (bottom tabs, quick actions,
// horizontal pet row) without touching the desktop JSX at all.
function useIsMobile(breakpoint = 960) {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
        const update = () => setIsMobile(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [breakpoint])
    return isMobile
}

function Stepper({ current }) {
    return (
        <div className="nvc-steps">
            {STEPS.map((s, i) => (
                <i key={s.key} className={i <= current ? "on" : ""} />
            ))}
        </div>
    )
}

// ── Horizontal day-picker (next 14 days) + slot grid ────────────────────────
function DayStrip({ selectedDate, onSelect, minDate }) {
    const days = []
    const start = new Date(minDate + "T12:00:00")
    for (let i = 0; i < 14; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        days.push(d)
    }
    const fmt = (d) => d.toISOString().split("T")[0]
    return (
        <div className="nvc-days">
            {days.map((d) => {
                const key = fmt(d)
                return (
                    <button
                        key={key}
                        className={`nvc-day ${selectedDate === key ? "sel" : ""}`}
                        onClick={() => onSelect(key)}
                    >
                        <small>
                            {d.toLocaleDateString("en-AE", { weekday: "short" })}
                        </small>
                        <b>{d.getDate()}</b>
                    </button>
                )
            })}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// BOOKING WIZARD
// ═══════════════════════════════════════════════════════════════════════════

function BookingWizard({ onGoToAccount }) {
    const [config, setConfig] = useState(null)
    const [configError, setConfigError] = useState(null)
    const [branches, setBranches] = useState({})
    const [separations, setSeparations] = useState([])

    const [stepIndex, setStepIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [loadingMsg, setLoadingMsg] = useState("")
    const [success, setSuccess] = useState(false)

    const [selectedBranch, setSelectedBranch] = useState("")
    const [selectedResource, setSelectedResource] = useState(null)
    const [selectedApptType, setSelectedApptType] = useState(null)
    const [selectedDate, setSelectedDate] = useState("")
    const [slots, setSlots] = useState([])
    const [slotsLoading, setSlotsLoading] = useState(false)
    const [selectedSlot, setSelectedSlot] = useState(null)
    const [comments, setComments] = useState("")

    const [identifier, setIdentifier] = useState("")
    const [identifierError, setIdentifierError] = useState("")
    const [contactResult, setContactResult] = useState(null)

    const [email, setEmail] = useState("")
    const [ownerName, setOwnerName] = useState("")
    const [ownerPhone, setOwnerPhone] = useState("")
    const [selectedAnimal, setSelectedAnimal] = useState(null)
    const [isNewPet, setIsNewPet] = useState(false)
    const [newPet, setNewPet] = useState({ name: "", species: "Dog", breed: "" })

    const [bookingRef, setBookingRef] = useState(null)
    const [bookError, setBookError] = useState("")

    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch(`${API_BASE}/api/startup`)
                const data = await res.json()
                if (data.error) throw new Error(data.error)
                setConfig(data)
                if (data.separations?.length) setSeparations(data.separations)
                const map = {}
                for (const r of data.resources) {
                    const key = r.separationName || "Main Clinic"
                    if (!map[key]) map[key] = []
                    map[key].push(r)
                }
                setBranches(map)
                if (data.appointmentTypes?.length)
                    setSelectedApptType(data.appointmentTypes[0])
            } catch {
                setConfigError(
                    "Unable to load clinic information. Please call " +
                        CLINIC_PHONE_DISPLAY +
                        "."
                )
            }
        })()
    }, [])

    useEffect(() => {
        if (!selectedBranch || !branches[selectedBranch]) return
        setSelectedResource(branches[selectedBranch][0])
    }, [selectedBranch, branches])

    useEffect(() => {
        if (!selectedDate || !selectedResource || !selectedApptType) return
        setSlotsLoading(true)
        setSlots([])
        setSelectedSlot(null)
        fetch(
            `${API_BASE}/api/slots?date=${selectedDate}&appt_type_uid=${selectedApptType.uid}&resource_uid=${selectedResource.uid}&duration=${selectedApptType.duration || 30}`
        )
            .then((r) => r.json())
            .then((d) => {
                setSlots(d.slots || [])
                setSlotsLoading(false)
            })
            .catch(() => setSlotsLoading(false))
    }, [selectedDate, selectedResource, selectedApptType])

    const handleIdentifierSubmit = async () => {
        const val = identifier.trim()
        if (!val) {
            setIdentifierError("Please enter your email or phone number.")
            return
        }
        if (!isEmail(val) && !isPhone(val)) {
            setIdentifierError("Please enter a valid email or phone number.")
            return
        }
        setIdentifierError("")
        setLoading(true)
        setLoadingMsg("Looking up your account…")
        const params = isEmail(val)
            ? `email=${encodeURIComponent(val)}&phone=`
            : `phone=${encodeURIComponent(val)}&email=`
        const res = await fetch(`${API_BASE}/api/contact?${params}`)
        const data = await res.json()
        setContactResult(data)
        if (data.found) {
            setOwnerName(`${data.contact.first_name} ${data.contact.last_name}`)
            setOwnerPhone(data.contact.phone || "")
            setEmail(data.contact.email || (isEmail(val) ? val : ""))
        } else {
            if (isEmail(val)) setEmail(val)
            else setOwnerPhone(val)
        }
        setLoading(false)
        goNext()
    }

    const handleConfirm = async () => {
        setBookError("")
        setLoading(true)
        setLoadingMsg("Confirming your appointment…")
        try {
            const res = await fetch(`${API_BASE}/api/book`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    owner_name: ownerName,
                    owner_phone: ownerPhone,
                    contact_id: contactResult?.found
                        ? contactResult.contact.id
                        : undefined,
                    contact_uid: contactResult?.found
                        ? contactResult.contact.uid
                        : undefined,
                    animal_id: selectedAnimal?.id,
                    animal_uid: selectedAnimal?.uid,
                    new_pet: isNewPet ? newPet : undefined,
                    appt_type_uid: selectedApptType?.uid,
                    resource_uid: selectedResource?.uid,
                    start_time: selectedSlot?.start_time,
                    start_iso: selectedSlot?.start_iso,
                    end_time: selectedSlot?.end_time,
                    duration: selectedApptType?.duration ?? 30,
                    description: `${selectedApptType?.name} — ${selectedBranch}${comments ? ` | ${comments}` : ""}`,
                }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.error || "Booking failed")
            setBookingRef(data.reference)
            setSuccess(true)
        } catch {
            setBookError(
                "Couldn't confirm your booking. Please try again or call " +
                    CLINIC_PHONE_DISPLAY +
                    "."
            )
        }
        setLoading(false)
    }

    const reset = () => {
        setSuccess(false)
        setStepIndex(0)
        setSelectedBranch("")
        setSelectedResource(null)
        setSelectedDate("")
        setSlots([])
        setSelectedSlot(null)
        setComments("")
        setIdentifier("")
        setIdentifierError("")
        setContactResult(null)
        setEmail("")
        setOwnerName("")
        setOwnerPhone("")
        setSelectedAnimal(null)
        setIsNewPet(false)
        setNewPet({ name: "", species: "Dog", breed: "" })
        setBookingRef(null)
        setBookError("")
    }

    const petName = isNewPet ? newPet.name : selectedAnimal?.name
    const petOk = isNewPet ? !!(newPet.name && ownerName) : !!selectedAnimal

    const canContinue = {
        clinic: !!selectedBranch,
        reason: !!selectedApptType,
        vet: !!selectedResource,
        time: !!selectedSlot,
        details: true,
        personal: true,
        pet: petOk,
        summary: true,
    }[STEPS[stepIndex].key]

    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const minDate = tomorrow.toISOString().split("T")[0]

    const goNext = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
    const goBack = () => setStepIndex((i) => Math.max(i - 1, 0))
    const stepKey = STEPS[stepIndex].key

    if (configError) {
        return (
            <div className="nvc-wrap">
                <div className="nvc-shell">
                    <div className="nvc-h1 nvc-h1-center">Something went wrong</div>
                    <div className="nvc-h1-sub nvc-h1-sub-center">{configError}</div>
                </div>
            </div>
        )
    }

    return (
        <div className="nvc-wrap">
            <style>{css}</style>
            <div className="nvc-shell">
                <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <button
                        onClick={onGoToAccount}
                        style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans }}
                    >
                        My Account →
                    </button>
                </div>

                {loading && (
                    <div className="nvc-loading-wrap">
                        <div className="nvc-spinner" />
                        <div style={{ fontSize: 14, color: T.muted }}>{loadingMsg}</div>
                    </div>
                )}

                {!loading && success && (
                    <div className="nvc-done">
                        <span className="ring">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5" />
                            </svg>
                        </span>
                        <h2>Appointment booked</h2>
                        <p>
                            We'll see <strong>{petName}</strong> on{" "}
                            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AE", { day: "numeric", month: "long" })}{" "}
                            at {selectedSlot?.label} at our <strong>{selectedBranch}</strong> branch.
                        </p>
                        <div className="nvc-refbox">
                            <div className="nvc-ref-label">Booking Reference</div>
                            <div className="nvc-ref-code">{bookingRef}</div>
                        </div>
                        <p style={{ fontSize: 13, marginBottom: 24 }}>
                            Confirmation sent to <strong>{email || ownerPhone}</strong>.<br />
                            Questions?{" "}
                            <a href={`tel:${CLINIC_PHONE}`} style={{ color: T.blue }}>
                                {CLINIC_PHONE_DISPLAY}
                            </a>
                        </p>
                        <button className="nvc-btn" style={{ maxWidth: 320, margin: "0 auto" }} onClick={reset}>
                            Book another appointment
                        </button>
                    </div>
                )}

                {!loading && !success && !config && (
                    <div className="nvc-loading-wrap">
                        <div className="nvc-spinner" />
                        <div style={{ fontSize: 14, color: T.muted }}>Loading clinic information…</div>
                    </div>
                )}

                {!loading && !success && config && (
                    <>
                        <Stepper current={stepIndex} />

                        {stepKey === "clinic" && (
                            <>
                                <div className="nvc-h1">Which clinic?</div>
                                <div className="nvc-h1-sub">Choose where you would like to be seen</div>
                                <div className="nvc-optgrid">
                                    {Object.keys(branches).map((branch) => {
                                        const sep = separations.find((s) => s.name === branch)
                                        const selected = selectedBranch === branch
                                        return (
                                            <button
                                                key={branch}
                                                className={`nvc-opt ${selected ? "sel" : ""}`}
                                                onClick={() => setSelectedBranch(branch)}
                                            >
                                                <span className="nvc-opt-ic">
                                                    {sep?.photo ? <img src={sep.photo} alt="" /> : "🏥"}
                                                </span>
                                                <span className="nvc-opt-tx">
                                                    <b>{branch}</b>
                                                    <span>{sep?.address || (sep?.hours ? sep.hours : "")}</span>
                                                    {sep?.hours && sep?.address && <span>{sep.hours}</span>}
                                                </span>
                                                <span className="nvc-opt-tick">
                                                    <CheckIcon />
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </>
                        )}

                        {stepKey === "reason" && (
                            <>
                                <div className="nvc-h1">What do they need?</div>
                                <div className="nvc-h1-sub">{selectedBranch}</div>
                                <div className="nvc-optgrid">
                                    {config.appointmentTypes.map((t, i) => (
                                        <button
                                            key={t.uid}
                                            className={`nvc-opt ${selectedApptType?.uid === t.uid ? "sel" : ""}`}
                                            onClick={() => setSelectedApptType(t)}
                                        >
                                            <span className="nvc-opt-ic">
                                                {t.photo ? (
                                                    <img src={t.photo} alt="" />
                                                ) : (
                                                    REASON_ICONS[i % REASON_ICONS.length]
                                                )}
                                            </span>
                                            <span className="nvc-opt-tx">
                                                <b>{t.name}</b>
                                                <span>{t.duration} minutes</span>
                                            </span>
                                            <span className="nvc-opt-tick">
                                                <CheckIcon />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {stepKey === "vet" && (
                            <>
                                <div className="nvc-h1">Who would you like to see?</div>
                                <div className="nvc-h1-sub">
                                    {selectedBranch} · {selectedApptType?.name}
                                </div>
                                <div className="nvc-optgrid">
                                    {(branches[selectedBranch] || []).map((r) => (
                                        <button
                                            key={r.uid}
                                            className={`nvc-opt vopt ${selectedResource?.uid === r.uid ? "sel" : ""}`}
                                            onClick={() => setSelectedResource(r)}
                                        >
                                            <span className="nvc-opt-ic">
                                                {r.photo ? <img src={r.photo} alt="" /> : initials(r.name)}
                                            </span>
                                            <span className="nvc-opt-tx">
                                                <b>{r.name}</b>
                                                <span>Available at {selectedBranch}</span>
                                            </span>
                                            <span className="nvc-opt-tick">
                                                <CheckIcon />
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {stepKey === "time" && (
                            <>
                                <div className="nvc-h1">Pick a time</div>
                                <div className="nvc-h1-sub">{selectedResource?.name}</div>
                                <div className="nvc-timewrap">
                                    <div>
                                        <DayStrip selectedDate={selectedDate} onSelect={setSelectedDate} minDate={minDate} />
                                        {!selectedDate && (
                                            <div style={{ fontSize: 13, color: T.muted }}>
                                                Select a date to see available times.
                                            </div>
                                        )}
                                        {selectedDate && slotsLoading && (
                                            <div style={{ fontSize: 13, color: T.muted }}>Checking availability…</div>
                                        )}
                                        {selectedDate && !slotsLoading && slots.length === 0 && (
                                            <div style={{ fontSize: 13, color: T.muted }}>
                                                No times available on this date. Please try another day.
                                            </div>
                                        )}
                                        {selectedDate && !slotsLoading && slots.length > 0 && (
                                            <div className="nvc-slots">
                                                {slots.map((slot, i) => (
                                                    <button
                                                        key={i}
                                                        className={`nvc-slotbtn ${selectedSlot?.start_time === slot.start_time ? "sel" : ""}`}
                                                        onClick={() => setSelectedSlot(slot)}
                                                    >
                                                        {slot.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 11, letterSpacing: "0.13em", textTransform: "uppercase", color: T.blue, fontWeight: 500, margin: "0 0 10px" }}>
                                            Booking summary
                                        </p>
                                        <div className="nvc-sum">
                                            <div className="r"><span>Clinic</span><b>{selectedBranch}</b></div>
                                            <div className="r"><span>Service</span><b>{selectedApptType?.name}</b></div>
                                            <div className="r"><span>Vet</span><b>{selectedResource?.name}</b></div>
                                            <div className="r">
                                                <span>When</span>
                                                <b>
                                                    {selectedDate
                                                        ? new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AE", { day: "numeric", month: "short" })
                                                        : "—"}
                                                    {selectedSlot ? `, ${selectedSlot.label}` : ""}
                                                </b>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {stepKey === "details" && (
                            <>
                                <div className="nvc-h1">Anything else we should know?</div>
                                <div className="nvc-h1-sub">Add any notes for the vet ahead of your visit — this step is optional.</div>
                                <div className="nvc-form-wrap">
                                    <div className="nvc-form-field">
                                        <label>Comments</label>
                                        <textarea
                                            className="nvc-input"
                                            placeholder="e.g. My dog has been limping on his front leg since yesterday…"
                                            value={comments}
                                            onChange={(e) => setComments(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {stepKey === "personal" && (
                            <>
                                <div className="nvc-h1">Who are you?</div>
                                <div className="nvc-h1-sub">We need your email or phone number to identify who you are.</div>
                                <div className="nvc-form-wrap">
                                    <div className="nvc-form-field">
                                        <label>Email or phone number</label>
                                        <input
                                            className={`nvc-input ${identifierError ? "error" : ""}`}
                                            type="text"
                                            placeholder="e.g. jane.doe@example.com"
                                            value={identifier}
                                            onChange={(e) => {
                                                setIdentifier(e.target.value)
                                                setIdentifierError("")
                                            }}
                                            onKeyDown={(e) => e.key === "Enter" && handleIdentifierSubmit()}
                                            autoFocus
                                        />
                                        {identifierError && <div className="nvc-error-text">{identifierError}</div>}
                                        <div style={{ fontSize: 12, color: T.muted, marginTop: 8, lineHeight: 1.6 }}>
                                            If you have been with us before, please use the email or phone from your previous bookings.
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {stepKey === "pet" && (
                            <>
                                <div className="nvc-h1">
                                    {contactResult?.found ? `Welcome back, ${contactResult.contact.first_name}!` : "Tell us about your pet"}
                                </div>
                                <div className="nvc-h1-sub">
                                    {contactResult?.found ? "Which pet is this appointment for?" : "A few details about you and your pet."}
                                </div>
                                <div className="nvc-form-wrap">
                                    {!contactResult?.found && (
                                        <>
                                            <div className="nvc-form-field">
                                                <label>Your full name</label>
                                                <input
                                                    className="nvc-input"
                                                    placeholder="Sarah Al-Mansoori"
                                                    value={ownerName}
                                                    onChange={(e) => setOwnerName(e.target.value)}
                                                />
                                            </div>
                                            <div className="nvc-form-grid2" style={{ marginBottom: 16 }}>
                                                <div className="nvc-form-field" style={{ marginBottom: 0 }}>
                                                    <label>Email</label>
                                                    <input
                                                        className="nvc-input"
                                                        type="email"
                                                        placeholder="you@example.com"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                    />
                                                </div>
                                                <div className="nvc-form-field" style={{ marginBottom: 0 }}>
                                                    <label>Phone</label>
                                                    <input
                                                        className="nvc-input"
                                                        placeholder="+971 50 000 0000"
                                                        value={ownerPhone}
                                                        onChange={(e) => setOwnerPhone(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <div className="nvc-divider">
                                                <div className="nvc-divider-line" />
                                                <span className="nvc-divider-text">Your pet</span>
                                                <div className="nvc-divider-line" />
                                            </div>
                                        </>
                                    )}

                                    {contactResult?.found && contactResult.animals.length > 0 && (
                                        <>
                                            <div className="nvc-petchips">
                                                {contactResult.animals.map((a) => (
                                                    <div
                                                        key={a.id}
                                                        className={`nvc-petchip ${selectedAnimal?.id === a.id ? "sel" : ""}`}
                                                        onClick={() => {
                                                            setSelectedAnimal(a)
                                                            setIsNewPet(false)
                                                        }}
                                                    >
                                                        <span style={{ fontSize: 22 }}>{EMOJI[a.species] || "🐾"}</span>
                                                        <div>
                                                            <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{a.name}</div>
                                                            <div style={{ fontSize: 11, color: T.muted }}>{a.breed} · {a.age}</div>
                                                        </div>
                                                        {selectedAnimal?.id === a.id && <span style={{ color: T.blue, marginLeft: 4 }}>✓</span>}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="nvc-divider">
                                                <div className="nvc-divider-line" />
                                                <span className="nvc-divider-text">or add a new pet</span>
                                                <div className="nvc-divider-line" />
                                            </div>
                                        </>
                                    )}

                                    <div
                                        className="nvc-addpet"
                                        onClick={() => {
                                            setIsNewPet(true)
                                            setSelectedAnimal(null)
                                        }}
                                    >
                                        <span style={{ fontSize: 18 }}>+</span> Add a new pet
                                        {isNewPet && <span style={{ marginLeft: 8, color: T.blue }}>✓</span>}
                                    </div>

                                    {isNewPet && (
                                        <div style={{ background: T.blueWash, borderRadius: 12, padding: 18 }}>
                                            <div className="nvc-form-field">
                                                <label>Pet's name</label>
                                                <input
                                                    className="nvc-input"
                                                    placeholder="e.g. Bella"
                                                    value={newPet.name}
                                                    onChange={(e) => setNewPet({ ...newPet, name: e.target.value })}
                                                />
                                            </div>
                                            <div className="nvc-form-grid2">
                                                <div className="nvc-form-field" style={{ marginBottom: 0 }}>
                                                    <label>Species</label>
                                                    <select
                                                        className="nvc-input"
                                                        value={newPet.species}
                                                        onChange={(e) => setNewPet({ ...newPet, species: e.target.value })}
                                                    >
                                                        {Object.keys(EMOJI).map((sp) => (
                                                            <option key={sp}>{sp}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="nvc-form-field" style={{ marginBottom: 0 }}>
                                                    <label>Breed</label>
                                                    <input
                                                        className="nvc-input"
                                                        placeholder="Optional"
                                                        value={newPet.breed}
                                                        onChange={(e) => setNewPet({ ...newPet, breed: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {stepKey === "summary" && (
                            <>
                                <div className="nvc-h1">Review your booking</div>
                                <div className="nvc-h1-sub">Please confirm the details below.</div>
                                <div className="nvc-sum" style={{ maxWidth: 480, margin: "0 auto 24px" }}>
                                    {[
                                        ["Patient", `${petName} (${isNewPet ? newPet.species : selectedAnimal?.species})`],
                                        ["Owner", ownerName],
                                        ["Branch", selectedBranch],
                                        ["Vet", selectedResource?.name],
                                        ["Service", selectedApptType?.name],
                                        [
                                            "Date",
                                            new Date(selectedDate + "T12:00:00").toLocaleDateString("en-AE", {
                                                weekday: "short",
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            }),
                                        ],
                                        ["Time", selectedSlot?.label],
                                        ["Duration", `${selectedApptType?.duration} min`],
                                    ].map(([l, v]) => (
                                        <div key={l} className="r">
                                            <span>{l}</span>
                                            <b>{v}</b>
                                        </div>
                                    ))}
                                </div>
                                {bookError && (
                                    <div style={{ fontSize: 13, color: T.urgent, textAlign: "center", marginBottom: 12 }}>{bookError}</div>
                                )}
                                <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.6, textAlign: "center", maxWidth: 420, margin: "0 auto 20px" }}>
                                    Confirmation will be sent to <strong>{email || ownerPhone}</strong>. Cancel or reschedule up to 24 hours before your appointment.
                                </p>
                            </>
                        )}

                        <div className="nvc-navrow">
                            <div className="nvc-navrow-inner">
                                {stepIndex > 0 ? (
                                    <button className="nvc-btn out sm" onClick={goBack}>
                                        Back
                                    </button>
                                ) : (
                                    <span />
                                )}
                                {stepKey === "personal" ? (
                                    <button className="nvc-btn sm" onClick={handleIdentifierSubmit}>
                                        Continue
                                    </button>
                                ) : stepKey === "summary" ? (
                                    <button className="nvc-btn sm" onClick={handleConfirm}>
                                        Confirm appointment
                                    </button>
                                ) : (
                                    <button className="nvc-btn sm" disabled={!canContinue} onClick={goNext}>
                                        Continue
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCOUNT PORTAL
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_COLORS = {
    confirmed: { bg: T.blueWash, text: T.blueDeep },
    unconfirmed: { bg: T.amberWash, text: T.amber },
    arrived: { bg: T.blueWash, text: T.blue },
    completed: { bg: T.okWash, text: T.ok },
    cancelled: { bg: T.urgentWash, text: T.urgent },
    "did not arrive": { bg: T.urgentWash, text: T.urgent },
}

function StatusBadge({ status }) {
    if (!status || status === "Unknown") return null
    const colors = STATUS_COLORS[status.toLowerCase()] ?? { bg: T.cream, text: T.muted }
    return (
        <span
            style={{
                background: colors.bg,
                color: colors.text,
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                whiteSpace: "nowrap",
            }}
        >
            {status}
        </span>
    )
}

function Modal({ onClose, children }) {
    return (
        <div className="nvc-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="nvc-modal">{children}</div>
        </div>
    )
}

const SIDE_ICONS = {
    home: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        </svg>
    ),
    book: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
    ),
    pets: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z" />
        </svg>
    ),
    owner: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
    ),
    bookings: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
    ),
    financials: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2h7l5 5v15H6z" />
            <path d="M13 2v5h5" />
        </svg>
    ),
}

function AccountPortal({ onBackToBooking }) {
    const [checkingSession, setCheckingSession] = useState(true)
    const [loggedIn, setLoggedIn] = useState(false)
    const [profile, setProfile] = useState(null)
    const isMobile = useIsMobile()

    const [stage, setStage] = useState("identifier") // "identifier" | "otp" | "confirm"
    const [identifier, setIdentifier] = useState("")
    const [code, setCode] = useState("")
    const [error, setError] = useState("")
    const [loading, setLoading] = useState(false)
    const [agreedToPolicy, setAgreedToPolicy] = useState(false)
    const [confirmPets, setConfirmPets] = useState(null)
    const [pendingProfile, setPendingProfile] = useState(null)

    const [section, setSection] = useState("home") // home | owner | pets | bookings | financials
    const [bookingsSubTab, setBookingsSubTab] = useState("upcoming")

    const [pets, setPets] = useState(null)
    const [appointments, setAppointments] = useState(null)
    const [financials, setFinancials] = useState(null)
    const [expandedId, setExpandedId] = useState(null)

    const [editingProfile, setEditingProfile] = useState(false)
    const [showMoreDetails, setShowMoreDetails] = useState(false)
    const [profileForm, setProfileForm] = useState({
        first_name: "",
        last_name: "",
        phone: "",
        emirates_id: "",
        date_of_birth: "",
        business_name: "",
        passport_number: "",
    })
    const [profileSaving, setProfileSaving] = useState(false)
    const [profileError, setProfileError] = useState("")

    const [petModal, setPetModal] = useState(null)
    const [petForm, setPetForm] = useState({
        name: "",
        species_id: "",
        breed_id: "",
        sex_id: "",
        colour_id: "",
        dob: "",
    })
    const [petSaving, setPetSaving] = useState(false)
    const [petError, setPetError] = useState("")
    const [petOptions, setPetOptions] = useState({ species: [], sexes: [], colours: [], breeds: [] })
    const [petOptionsLoading, setPetOptionsLoading] = useState(false)
    const [petPhotoUploading, setPetPhotoUploading] = useState(null)

    const [healthOverviewPetId, setHealthOverviewPetId] = useState(null)
    const [consultId, setConsultId] = useState(null)
    const [petConsults, setPetConsults] = useState({})

    const [cancellingId, setCancellingId] = useState(null)
    const [rescheduleModal, setRescheduleModal] = useState(null) // the appointment being rescheduled
    const [rescheduleDate, setRescheduleDate] = useState("")
    const [rescheduleSlots, setRescheduleSlots] = useState(null)
    const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false)
    const [rescheduleManualTime, setRescheduleManualTime] = useState("")
    const [rescheduleSaving, setRescheduleSaving] = useState(false)
    const [rescheduleError, setRescheduleError] = useState("")

    const [toast, showToast] = useToast()

    const refreshAppointments = () => {
        fetch(`${API_BASE}/api/portal/appointments`, { credentials: "include" })
            .then((r) => r.json())
            .then((d) => setAppointments(d.appointments || []))
            .catch(() => {})
    }

    const handleCancelAppointment = async (appointmentId) => {
        if (!window.confirm("Cancel this appointment?")) return
        setCancellingId(appointmentId)
        try {
            const res = await fetch(`${API_BASE}/api/portal/appointments/cancel`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ appointment_id: appointmentId }),
            })
            if (!res.ok) throw new Error()
            showToast("Appointment cancelled.")
            refreshAppointments()
        } catch {
            showToast("Couldn't cancel that appointment — please call the clinic.")
        } finally {
            setCancellingId(null)
        }
    }

    const openReschedule = (appt) => {
        setRescheduleModal(appt)
        setRescheduleError("")
        setRescheduleManualTime("")
        setRescheduleSlots(null)
        const d = new Date((appt.start_time ?? Date.now() / 1000) * 1000)
        setRescheduleDate(d.toISOString().split("T")[0])
    }

    useEffect(() => {
        if (!rescheduleModal || !rescheduleDate || !rescheduleModal.slot_check_available) return
        setRescheduleSlotsLoading(true)
        setRescheduleSlots(null)
        fetch(`${API_BASE}/api/slots?date=${rescheduleDate}&appt_type_uid=${rescheduleModal.appt_type_uid}&resource_uid=${rescheduleModal.resource_uid}&duration=${rescheduleModal.duration_minutes || 30}`)
            .then((r) => r.json())
            .then((d) => setRescheduleSlots(d.slots || []))
            .catch(() => setRescheduleSlots([]))
            .finally(() => setRescheduleSlotsLoading(false))
    }, [rescheduleModal, rescheduleDate])

    const submitReschedule = async (startIso) => {
        if (!rescheduleModal) return
        setRescheduleSaving(true)
        setRescheduleError("")
        try {
            const res = await fetch(`${API_BASE}/api/portal/appointments/reschedule`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    appointment_id: rescheduleModal.id,
                    start_iso: startIso,
                    duration_minutes: rescheduleModal.duration_minutes,
                }),
            })
            if (!res.ok) throw new Error()
            showToast("Appointment rescheduled.")
            setRescheduleModal(null)
            refreshAppointments()
        } catch {
            setRescheduleError("Couldn't save that time — please try again or call the clinic.")
        } finally {
            setRescheduleSaving(false)
        }
    }

    useEffect(() => {
        fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((d) => {
                setProfile(d.contact)
                setLoggedIn(true)
            })
            .catch(() => setLoggedIn(false))
            .finally(() => setCheckingSession(false))
    }, [])

    const handleRequestOtp = async () => {
        if (!identifier.trim()) {
            setError("Please enter your email or phone.")
            return
        }
        setError("")
        setLoading(true)
        try {
            await fetch(`${API_BASE}/api/auth/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ identifier: identifier.trim() }),
            })
            setStage("otp")
        } catch {
            setError("Something went wrong. Please try again.")
        }
        setLoading(false)
    }

    const handleVerifyOtp = async () => {
        if (!code.trim()) {
            setError("Please enter the code.")
            return
        }
        setError("")
        setLoading(true)
        try {
            const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ identifier: identifier.trim(), code: code.trim() }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Invalid code")
            const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
            const meData = await meRes.json()
            setPendingProfile(meData.contact)
            const petsRes = await fetch(`${API_BASE}/api/portal/pets`, { credentials: "include" })
            const petsData = await petsRes.json()
            setConfirmPets(petsData.pets || [])
            setStage("confirm")
        } catch (err) {
            setError(err.message)
        }
        setLoading(false)
    }

    const handleConfirmAccount = () => {
        setProfile(pendingProfile)
        setPets(confirmPets)
        setLoggedIn(true)
    }

    const handleRejectAccount = async () => {
        await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
        setPendingProfile(null)
        setConfirmPets(null)
        setStage("identifier")
        setIdentifier("")
        setCode("")
        setError("")
    }

    const handleLogout = async () => {
        await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
        setLoggedIn(false)
        setProfile(null)
        setStage("identifier")
        setIdentifier("")
        setCode("")
        setPets(null)
        setAppointments(null)
        setFinancials(null)
        setAgreedToPolicy(false)
        setPendingProfile(null)
        setConfirmPets(null)
    }

    const maskName = (first, last) => {
        if (!first) return ""
        const lastInitial = last ? last[0] : ""
        return `${first} ${lastInitial}${lastInitial ? "•••" : ""}`.trim()
    }
    const maskPhone = (phone) => {
        if (!phone) return "—"
        const digits = phone.replace(/\D/g, "")
        if (digits.length < 4) return phone
        return `•••• ${digits.slice(-4)}`
    }
    const maskEmail = (email) => {
        if (!email || !email.includes("@")) return "—"
        const [user, domain] = email.split("@")
        return `${user[0]}••••@${domain}`
    }

    const openEditProfile = () => {
        setProfileForm({
            first_name: profile?.first_name || "",
            last_name: profile?.last_name || "",
            phone: profile?.phone || "",
            emirates_id: profile?.emirates_id || "",
            date_of_birth: profile?.date_of_birth || "",
            business_name: profile?.business_name || "",
            passport_number: profile?.passport_number || "",
        })
        setProfileError("")
        setEditingProfile(true)
    }

    const handleSaveProfile = async () => {
        setProfileError("")
        setProfileSaving(true)
        try {
            const res = await fetch(`${API_BASE}/api/auth/me`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(profileForm),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to save")
            const meRes = await fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
            const meData = await meRes.json()
            setProfile(meData.contact)
            setEditingProfile(false)
        } catch (err) {
            setProfileError(err.message)
        }
        setProfileSaving(false)
    }

    const loadPetOptions = async (speciesId) => {
        setPetOptionsLoading(true)
        try {
            const url = speciesId
                ? `${API_BASE}/api/portal/pet-options?species_id=${speciesId}`
                : `${API_BASE}/api/portal/pet-options`
            const res = await fetch(url, { credentials: "include" })
            const data = await res.json()
            setPetOptions((prev) => ({
                species: data.species ?? prev.species,
                sexes: data.sexes ?? prev.sexes,
                colours: data.colours ?? prev.colours,
                breeds: data.breeds ?? [],
            }))
        } catch {
            // leave existing options in place on failure
        }
        setPetOptionsLoading(false)
    }

    const openAddPet = async () => {
        setPetForm({ name: "", species_id: "", breed_id: "", sex_id: "", colour_id: "", dob: "" })
        setPetError("")
        setPetModal("add")
        await loadPetOptions()
    }

    const openEditPet = async (pet) => {
        setPetForm({
            name: pet.name || "",
            species_id: pet.species_id ? String(pet.species_id) : "",
            breed_id: pet.breed_id ? String(pet.breed_id) : "",
            sex_id: pet.sex_id ? String(pet.sex_id) : "",
            colour_id: pet.colour_id ? String(pet.colour_id) : "",
            dob: pet.dob || "",
        })
        setPetError("")
        setPetModal(pet.id)
        await loadPetOptions(pet.species_id)
    }

    const handleSpeciesChange = async (speciesId) => {
        setPetForm((prev) => ({ ...prev, species_id: speciesId, breed_id: "" }))
        await loadPetOptions(speciesId)
    }

    const handleSavePet = async () => {
        if (!petForm.name.trim()) {
            setPetError("Pet name is required.")
            return
        }
        setPetError("")
        setPetSaving(true)
        try {
            const isNew = petModal === "add"
            const res = await fetch(`${API_BASE}/api/portal/pets`, {
                method: isNew ? "POST" : "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(isNew ? petForm : { ...petForm, animal_id: petModal }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to save pet")
            setPetModal(null)
            refetchPets()
        } catch (err) {
            setPetError(err.message)
        }
        setPetSaving(false)
    }

    const refetchPets = () => {
        fetch(`${API_BASE}/api/portal/pets`, { credentials: "include" })
            .then((r) => r.json())
            .then((d) => setPets(d.pets || []))
    }

    const handlePetPhotoSelect = async (animalId, file) => {
        if (!file) return
        setPetPhotoUploading(animalId)
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result.split(",")[1])
                reader.onerror = reject
                reader.readAsDataURL(file)
            })
            const res = await fetch(`${API_BASE}/api/portal/pet-photo`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    animal_id: animalId,
                    image_base64: base64,
                    file_name: file.name,
                    content_type: file.type,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Upload failed")
            refetchPets()
        } catch (err) {
            showToast(`Couldn't upload photo: ${err.message}`)
        }
        setPetPhotoUploading(null)
    }

    const ensurePetConsults = async (petId) => {
        if (petConsults[petId]) return
        setPetConsults((prev) => ({ ...prev, [petId]: "loading" }))
        try {
            const res = await fetch(`${API_BASE}/api/portal/pet-consults?animal_id=${petId}`, { credentials: "include" })
            const data = await res.json()
            setPetConsults((prev) => ({ ...prev, [petId]: data.consults || [] }))
        } catch {
            setPetConsults((prev) => ({ ...prev, [petId]: [] }))
        }
    }

    const openHealthOverview = (petId) => {
        setHealthOverviewPetId(petId)
        setConsultId(null)
        ensurePetConsults(petId)
    }

    useEffect(() => {
        if (!loggedIn) return
        if ((section === "home" || section === "pets") && !pets) refetchPets()
        if ((section === "home" || section === "bookings") && !appointments) {
            fetch(`${API_BASE}/api/portal/appointments`, { credentials: "include" })
                .then((r) => r.json())
                .then((d) => setAppointments(d.appointments || []))
        }
        if (section === "financials" && !financials) {
            fetch(`${API_BASE}/api/portal/financials`, { credentials: "include" })
                .then((r) => r.json())
                .then((d) => setFinancials(d))
        }
    }, [section, loggedIn])

    if (checkingSession) {
        return (
            <div className="nvc-wrap">
                <style>{css}</style>
                <div className="nvc-loading-wrap">
                    <div className="nvc-spinner" />
                </div>
            </div>
        )
    }

    // ── LOGIN VIEW ──────────────────────────────────────────────────────────
    if (!loggedIn && stage !== "confirm") {
        return (
            <div className="nvc-wrap">
                <style>{css}</style>
                <div className="nvc-auth">
                    <div className="nvc-auth-side">
                        <div className="nvc-auth-logo">Noble</div>
                        <div>
                            <h1>Your pet's records, in one place</h1>
                            <p>Book appointments, see visit history, and keep track of what is due. No paperwork to dig out.</p>
                            <ul>
                                {[
                                    "Book at any clinic, with any vet",
                                    "Every consultation and result, saved",
                                    "Reminders before vaccinations fall due",
                                ].map((t) => (
                                    <li key={t}>
                                        <CheckIcon />
                                        <span>{t}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <small>© Noble Veterinary Clinics</small>
                    </div>
                    <div className="nvc-auth-panel">
                        <div className="nvc-auth-card">
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                                <button
                                    onClick={onBackToBooking}
                                    style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: sans }}
                                >
                                    ← Back to booking
                                </button>
                            </div>
                            {stage === "identifier" ? (
                                <>
                                    <h2>Sign in</h2>
                                    <p className="sub">Enter the email or phone number on your Noble account and we'll send you a sign-in code.</p>
                                    <div className="nvc-form-field">
                                        <label>Email or phone</label>
                                        <input
                                            className="nvc-input"
                                            placeholder="you@example.com"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && agreedToPolicy && handleRequestOtp()}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="nvc-auth-check">
                                        <input
                                            type="checkbox"
                                            id="nvc-agree-policy"
                                            checked={agreedToPolicy}
                                            onChange={(e) => setAgreedToPolicy(e.target.checked)}
                                            style={{ marginTop: 2 }}
                                        />
                                        <label htmlFor="nvc-agree-policy">
                                            I agree to the Privacy Policy and consent to securely match my clinic records.
                                        </label>
                                    </div>
                                    {error && <div className="nvc-error-text">{error}</div>}
                                    <button className="nvc-btn full" disabled={loading || !agreedToPolicy} onClick={handleRequestOtp}>
                                        {loading ? "Sending…" : "Send me a code"}
                                    </button>
                                    <p className="nvc-auth-fine">
                                        No password to remember. We'll email or text you a six digit code each time you sign in.
                                        <br />
                                        Trouble signing in? <a href={CLINIC_WHATSAPP}>Message us on WhatsApp</a>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <h2>Enter your code</h2>
                                    <p className="sub">
                                        We sent a 6-digit code to <strong>{identifier}</strong>.
                                    </p>
                                    <div className="nvc-form-field">
                                        <label>Login code</label>
                                        <input
                                            className="nvc-input"
                                            placeholder="123456"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                                            autoFocus
                                            maxLength={6}
                                        />
                                    </div>
                                    {error && <div className="nvc-error-text">{error}</div>}
                                    <button className="nvc-btn full" disabled={loading} onClick={handleVerifyOtp}>
                                        {loading ? "Verifying…" : "Sign in"}
                                    </button>
                                    <p className="nvc-auth-fine">
                                        <button
                                            style={{ background: "none", border: "none", color: T.blue, fontWeight: 500, cursor: "pointer" }}
                                            onClick={() => {
                                                setStage("identifier")
                                                setCode("")
                                                setError("")
                                            }}
                                        >
                                            ← Use a different email/phone
                                        </button>
                                    </p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ── "WE FOUND YOUR ACCOUNT" CONFIRMATION VIEW ───────────────────────────
    if (!loggedIn && stage === "confirm") {
        return (
            <div className="nvc-wrap">
                <style>{css}</style>
                <div className="nvc-auth-panel" style={{ minHeight: "100vh" }}>
                    <div className="nvc-auth-card" style={{ maxWidth: 420 }}>
                        <div
                            style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: T.blueWash,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 22,
                                color: T.blue,
                                margin: "0 auto 16px",
                            }}
                        >
                            ✓
                        </div>
                        <h2 style={{ textAlign: "center" }}>We found your Noble account</h2>
                        <p className="sub" style={{ textAlign: "center" }}>
                            Please confirm these details to securely link your clinic records.
                        </p>
                        <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>
                                {maskName(pendingProfile?.first_name, pendingProfile?.last_name)}
                            </div>
                            <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{maskPhone(pendingProfile?.phone)}</div>
                            <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>{maskEmail(pendingProfile?.email)}</div>
                            {confirmPets && confirmPets.length > 0 && (
                                <>
                                    <diva
                                        style={{
                                            fontSize: 11,
                                            fontWeight: 700,
                                            color: T.muted,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.06em",
                                            borderTop: `1px solid ${T.line}`,
                                            paddingTop: 10,
                                            marginBottom: 8,
                                        }}
                                    >
                                        {confirmPets.length} pet record{confirmPets.length === 1 ? "" : "s"} found
                                    </div>
                                    {confirmPets.map((p) => (
                                        <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                {p.photo_url ? (
                                                    <img
                                                        src={`${API_BASE}${p.photo_url}`}
                                                        alt={p.name}
                                                        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                                                    />
                                                ) : (
                                                    <div
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: "50%",
                                                            background: T.blueWash,
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: 14,
                                                        }}
                                                    >
                                                        {EMOJI[p.species] || EMOJI.Other}
                                                    </div>
                                                )}
                                                <div>
                                                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{p.name}</div>
                                                    <div style={{ fontSize: 11, color: T.muted }}>{p.breed || p.species}</div>
                                                </div>
                                            </div>
                                            <span style={{ color: T.ok, fontSize: 16 }}>✓</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                        {error && <div className="nvc-error-text">{error}</div>}
                        <button className="nvc-btn full" style={{ marginBottom: 10 }} onClick={handleConfirmAccount}>
                            Yes, this is my account
                        </button>
                        <button
                            style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "block", margin: "0 auto" }}
                            onClick={handleRejectAccount}
                        >
                            This is not me
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── DASHBOARD ───────────────────────────────────────────────────────────
    const now = Math.floor(Date.now() / 1000)
    const upcomingAppts = (appointments || [])
        .filter((a) => (a.start_time ?? 0) >= now)
        .sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0))
    const pastAppts = (appointments || []).filter((a) => (a.start_time ?? 0) < now)

    const nextApptFor = (animalId) => upcomingAppts.find((a) => a.animal_id === animalId) ?? null
    const lastApptFor = (animalId) => pastAppts.find((a) => a.animal_id === animalId) ?? null

    const greeting = (() => {
        const h = new Date().getHours()
        if (h < 12) return "Good morning"
        if (h < 18) return "Good afternoon"
        return "Good evening"
    })()
    const homeNextAppt = upcomingAppts[0] ?? null
    const homeUpcomingRest = upcomingAppts.slice(1, 6)

    const NAV_ITEMS = [
        { key: "home", label: "Dashboard" },
        { key: "book", label: "Book appointment", action: onBackToBooking },
        { key: "pets", label: "My pets" },
        { key: "owner", label: "Account" },
    ]
    const MOBILE_TAB_LABELS = { home: "Home", book: "Book", pets: "Pets", owner: "Profile" }
    const SECTION_TITLES = {
        home: "Home",
        owner: "Account",
        pets: "My pets",
        bookings: "Bookings",
        financials: "Financials",
    }

    const mobileBack = () => {
        if (consultId) return setConsultId(null)
        if (healthOverviewPetId) return setHealthOverviewPetId(null)
        setSection("home")
    }
    const mobileShowsBack = section !== "home" || !!healthOverviewPetId || !!consultId

    const petAvatar = (p, size) =>
        p?.photo_url ? (
            <img src={`${API_BASE}${p.photo_url}`} alt={p.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
            <div style={{ width: size, height: size, borderRadius: "50%", background: T.cream, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.45 }}>
                {EMOJI[p?.species] || EMOJI.Other}
            </div>
        )

    const activePet = pets?.find((p) => p.id === healthOverviewPetId) || null
    const activeConsult = activePet ? (petConsults[activePet.id] || []) : []
    const activeConsultItem = Array.isArray(activeConsult) ? activeConsult.find((c) => c.id === consultId) : null

    return (
        <div className="nvc-wrap">
            <style>{css}</style>
            <div className="nvc-app">
                <aside className="nvc-side">
                    <div className="nvc-side-logo">Noble</div>
                    <nav>
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.key}
                                className={section === item.key ? "on" : ""}
                                onClick={() => (item.action ? item.action() : (setSection(item.key), setHealthOverviewPetId(null)))}
                            >
                                {SIDE_ICONS[item.key]}
                                {item.label}
                            </button>
                        ))}
                    </nav>
                    <div className="nvc-side-em">
                        <b><span className="dot" /> Emergency</b>
                        <span>24/7 emergency care available</span>
                        <a href={`tel:${CLINIC_PHONE}`}>Call {CLINIC_PHONE_DISPLAY}</a>
                    </div>
                    <div className="nvc-side-me">
                        <span className="av">{initials(`${profile?.first_name || ""} ${profile?.last_name || ""}`)}</span>
                        <span>
                            <b>{profile?.first_name} {profile?.last_name}</b>
                            <span>{profile?.email || profile?.phone}</span>
                        </span>
                    </div>
                </aside>

                <div className="nvc-mheader">
                    {mobileShowsBack ? (
                        <button className="back" onClick={mobileBack}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg>
                            {SECTION_TITLES[section] || "Noble"}
                        </button>
                    ) : (
                        <span className="logo">Noble</span>
                    )}
                    <a className="call" href={`tel:${CLINIC_PHONE}`} aria-label="Call clinic">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
                    </a>
                </div>

                <main className="nvc-main">
                    {/* ══ HOME ═══════════════════════════════════════════════════ */}
                    {section === "home" && (
                        <>
                            <div className="nvc-phead">
                                <div>
                                    <h1>{greeting}{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
                                    <p>{pets ? `${pets.length} pet${pets.length === 1 ? "" : "s"} on file` : "Loading your account…"}</p>
                                </div>
                                <button className="nvc-btn" onClick={onBackToBooking}>Book appointment</button>
                            </div>

                            <div className="nvc-quickgrid">
                                <button className="nvc-quicktile" onClick={onBackToBooking}>
                                    <span className="ic">{SIDE_ICONS.book}</span>
                                    <b>Book<br />appointment</b>
                                </button>
                                <a className="nvc-quicktile em" href={`tel:${CLINIC_PHONE}`}>
                                    <span className="ic">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
                                    </span>
                                    <b>Emergency<br />24/7</b>
                                </a>
                            </div>

                            <div className="nvc-grid2">
                                <div className="nvc-nextcard">
                                    <div className="t">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>
                                        Next appointment
                                    </div>
                                    {!appointments ? (
                                        <span>Loading…</span>
                                    ) : homeNextAppt ? (
                                        <>
                                            <b>{[pets?.find((p) => p.id === homeNextAppt.animal_id)?.name, homeNextAppt.description || "Appointment"].filter(Boolean).join(" · ")}</b>
                                            <span>{fmtDate(homeNextAppt.start_time)}, {fmtTime(homeNextAppt.start_time)}</span>
                                            {(homeNextAppt.resource_name || homeNextAppt.location_address) && (
                                                <span>{[homeNextAppt.resource_name, homeNextAppt.location_address].filter(Boolean).join(" · ")}</span>
                                            )}
                                            <div className="acts">
                                                {homeNextAppt.directions_url && (
                                                    <a className="w" href={homeNextAppt.directions_url} target="_blank" rel="noreferrer">Directions</a>
                                                )}
                                                <button onClick={() => openReschedule(homeNextAppt)}>Reschedule</button>
                                                <button onClick={() => handleCancelAppointment(homeNextAppt.id)} disabled={cancellingId === homeNextAppt.id}>
                                                    {cancellingId === homeNextAppt.id ? "Cancelling…" : "Cancel"}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span>No upcoming appointments.</span>
                                            <div className="acts">
                                                <button className="w" onClick={onBackToBooking}>Book now</button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="nvc-panel">
                                    <h3>Coming up</h3>
                                    {!appointments ? (
                                        <div className="nvc-portal-empty" style={{ padding: "12px 0" }}>Loading…</div>
                                    ) : homeUpcomingRest.length === 0 ? (
                                        <div className="nvc-portal-empty" style={{ padding: "12px 0" }}>
                                            No reminders due yet — check back after your next visit.
                                        </div>
                                    ) : (
                                        homeUpcomingRest.map((a) => {
                                            const p = pets?.find((x) => x.id === a.animal_id)
                                            return (
                                                <button
                                                    key={a.id}
                                                    className="nvc-hrow"
                                                    onClick={() => setSection("bookings")}
                                                >
                                                    <span className="dt">
                                                        <b>{new Date(a.start_time * 1000).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}</b>
                                                        <small>{new Date(a.start_time * 1000).getFullYear()}</small>
                                                    </span>
                                                    <span className="tx">
                                                        <b>{a.description || "Appointment"}</b>
                                                        <span>{p?.name ? `${p.name} · ` : ""}{a.resource_name}</span>
                                                    </span>
                                                    <span className="ar"><ChevronIcon /></span>
                                                </button>
                                            )
                                        })
                                    )}
                                </div>
                            </div>

                            <div className="nvc-phead" style={{ margin: "34px 0 16px" }}>
                                <div><h1 style={{ fontSize: 24 }}>Your pets</h1></div>
                            </div>
                            <div className="nvc-petgrid nvc-home-petgrid">
                                {!pets ? (
                                    <div className="nvc-portal-empty">Loading…</div>
                                ) : (
                                    <>
                                        {pets.map((p) => (
                                            <button
                                                key={p.id}
                                                className="nvc-pcard"
                                                onClick={() => {
                                                    setSection("pets")
                                                    openHealthOverview(p.id)
                                                }}
                                            >
                                                <span className="av">{petAvatar(p, 54)}</span>
                                                <b>{p.name}</b>
                                                <span>{p.breed || p.species}</span>
                                            </button>
                                        ))}
                                        <button className="nvc-pcard add" onClick={openAddPet}>+ Add a pet</button>
                                    </>
                                )}
                            </div>
                            <div className="nvc-petrow-mobile">
                                {pets && (
                                    <>
                                        {pets.map((p) => (
                                            <button
                                                key={p.id}
                                                className="nvc-pcard"
                                                onClick={() => {
                                                    setSection("pets")
                                                    openHealthOverview(p.id)
                                                }}
                                            >
                                                <span className="av">{petAvatar(p, 54)}</span>
                                                <b>{p.name}</b>
                                                <span>{p.breed || p.species}</span>
                                            </button>
                                        ))}
                                        <button className="nvc-pcard add" onClick={openAddPet}>+ Add</button>
                                    </>
                                )}
                            </div>

                            <div className="nvc-phead" style={{ margin: "34px 0 16px" }}>
                                <div><h1 style={{ fontSize: 24 }}>Recent visits</h1></div>
                                <button className="nvc-btn out sm" onClick={() => setSection("bookings")}>View all</button>
                            </div>
                            <div className="nvc-panel">
                                {!appointments ? (
                                    <div className="nvc-portal-empty">Loading…</div>
                                ) : pastAppts.length === 0 ? (
                                    <div className="nvc-portal-empty">No visits yet.</div>
                                ) : (
                                    pastAppts.slice(0, 5).map((a) => {
                                        const p = pets?.find((x) => x.id === a.animal_id)
                                        return (
                                            <button
                                                key={a.id}
                                                className="nvc-hrow"
                                                onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                                            >
                                                <span className="dt">
                                                    <b>{new Date(a.start_time * 1000).toLocaleDateString("en-AE", { day: "numeric", month: "short" })}</b>
                                                    <small>{new Date(a.start_time * 1000).getFullYear()}</small>
                                                </span>
                                                <span className="tx">
                                                    <b>{a.description || "Appointment"}</b>
                                                    <span>{p?.name ? `${p.name} · ` : ""}{a.resource_name}</span>
                                                </span>
                                                <span className="ar"><ChevronIcon /></span>
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* ══ HEALTH OVERVIEW / CONSULT ═════════════════════════════ */}
                    {section === "pets" && healthOverviewPetId && activePet && !consultId && (
                        <>
                            <div className="nvc-phead" style={{ marginBottom: 20 }}>
                                <button className="nvc-btn out sm" style={{ margin: 0 }} onClick={() => setHealthOverviewPetId(null)}>← All pets</button>
                                <button className="nvc-btn out sm" onClick={() => openEditPet(activePet)}>Edit {activePet.name}'s info</button>
                            </div>
                            <div className="nvc-pettop">
                                <span className="av" style={{ position: "relative" }}>
                                    {petAvatar(activePet, 96)}
                                    <label style={{ position: "absolute", bottom: 0, right: 0, cursor: "pointer" }}>
                                        <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            style={{ display: "none" }}
                                            onChange={(e) => e.target.files[0] && handlePetPhotoSelect(activePet.id, e.target.files[0])}
                                        />
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                width: 26,
                                                height: 26,
                                                borderRadius: "50%",
                                                background: T.blue,
                                                color: "#fff",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontSize: 12,
                                            }}
                                        >
                                            {petPhotoUploading === activePet.id ? "…" : "✎"}
                                        </span>
                                    </label>
                                </span>
                                <div>
                                    <h1>{activePet.name}</h1>
                                    <p>{[activePet.breed || activePet.species, activePet.sex, activePet.age].filter(Boolean).join(" · ")}</p>
                                    <div className="nvc-chips">
                                        <span>{activePet.weight ? `${activePet.weight} ${activePet.weight_unit || ""}`.trim() : "Weight on file soon"}</span>
                                        <span>{activePet.microchip_number ? "Microchipped" : "No microchip on file"}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="nvc-grid2">
                                <div>
                                    <div className="nvc-panel">
                                        <h3>Visit history</h3>
                                        {petConsults[activePet.id] === "loading" && <div className="nvc-portal-empty">Loading…</div>}
                                        {Array.isArray(petConsults[activePet.id]) && petConsults[activePet.id].length === 0 && (
                                            <div className="nvc-portal-empty">No consult records found.</div>
                                        )}
                                        {Array.isArray(petConsults[activePet.id]) &&
                                            petConsults[activePet.id].map((c) => (
                                                <button key={c.id} className="nvc-hrow" onClick={() => setConsultId(c.id)}>
                                                    <span className="dt">
                                                        <b>{c.date ? new Date(c.date * 1000 || c.date).toLocaleDateString("en-AE", { day: "numeric", month: "short" }) : "—"}</b>
                                                    </span>
                                                    <span className="tx">
                                                        <b>{c.notes ? c.notes.split(/[.\n]/)[0].slice(0, 60) : "Consultation"}</b>
                                                        <span>{c.vet || c.resource_name || ""}</span>
                                                    </span>
                                                    <span className="ar"><ChevronIcon /></span>
                                                </button>
                                            ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="nvc-due ok" style={{ marginBottom: 16 }}>
                                        <div className="r">
                                            <span><b>Vaccinations</b><small>Not tracked here yet</small></span>
                                            <span className="st">On file at clinic</span>
                                        </div>
                                    </div>
                                    <button className="nvc-btn full" onClick={onBackToBooking}>Book appointment for {activePet.name}</button>
                                </div>
                            </div>
                        </>
                    )}

                    {section === "pets" && healthOverviewPetId && activePet && consultId && (
                        <>
                            <button className="nvc-btn out sm" style={{ marginBottom: 20 }} onClick={() => setConsultId(null)}>← Back to {activePet.name}</button>
                            <div className="nvc-phead">
                                <div>
                                    <h1 style={{ fontSize: 26 }}>Consultation</h1>
                                    <p>
                                        {activeConsultItem?.date
                                            ? new Date((activeConsultItem.date * 1000) || activeConsultItem.date).toLocaleDateString("en-AE", { day: "numeric", month: "long", year: "numeric" })
                                            : ""}{" "}
                                        · {activePet.name}
                                    </p>
                                </div>
                            </div>
                            <div className="nvc-cgrid">
                                <div>
                                    <div className="nvc-blk">
                                        <p className="bl">Notes</p>
                                        <p>{activeConsultItem?.notes || "No notes on file for this visit."}</p>
                                    </div>
                                </div>
                                <div>
                                    <div className="nvc-sum" style={{ marginBottom: 18 }}>
                                        <div className="r"><span>Pet</span><b>{activePet.name}</b></div>
                                        <div className="r"><span>Seen by</span><b>{activeConsultItem?.vet || activeConsultItem?.resource_name || "—"}</b></div>
                                        <div className="r"><span>Clinic</span><b>{activeConsultItem?.clinic || "—"}</b></div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                                        <a className="nvc-btn out sm" href={CLINIC_WHATSAPP}>Ask a question</a>
                                        <button className="nvc-btn sm" onClick={onBackToBooking}>Book follow-up</button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══ PETS LIST ══════════════════════════════════════════════ */}
                    {section === "pets" && !healthOverviewPetId && (
                        <>
                            <div className="nvc-phead">
                                <div>
                                    <h1>My pets</h1>
                                    <p>Everything on record for each of them</p>
                                </div>
                                <button className="nvc-btn out" onClick={openAddPet}>+ Add a pet</button>
                            </div>
                            {isMobile ? (
                                <div className="nvc-petrows-mobile">
                                    {!pets ? (
                                        <div className="nvc-portal-empty">Loading your pets…</div>
                                    ) : pets.length === 0 ? (
                                        <div className="nvc-portal-empty">No pets on file yet.</div>
                                    ) : (
                                        pets.map((p) => (
                                            <div key={p.id} className="nvc-opt" style={{ cursor: "default" }}>
                                                <button
                                                    onClick={() => openHealthOverview(p.id)}
                                                    style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, background: "none", border: "none", textAlign: "left", padding: 0, cursor: "pointer" }}
                                                >
                                                    <span style={{ flexShrink: 0 }}>{petAvatar(p, 42)}</span>
                                                    <span className="nvc-opt-tx">
                                                        <b>{p.name}</b>
                                                        <span>{p.breed || p.species}</span>
                                                    </span>
                                                </button>
                                                <button
                                                    onClick={() => openEditPet(p)}
                                                    style={{ background: "none", border: "none", color: T.blue, fontSize: 13, fontWeight: 600, padding: "0 8px", cursor: "pointer" }}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                                <div className="nvc-petgrid">
                                    {!pets ? (
                                        <div className="nvc-portal-empty">Loading your pets…</div>
                                    ) : pets.length === 0 ? (
                                        <div className="nvc-portal-empty">No pets on file yet.</div>
                                    ) : (
                                        pets.map((p) => (
                                            <div key={p.id} className="nvc-pcard" style={{ position: "relative" }}>
                                                <button
                                                    onClick={() => openHealthOverview(p.id)}
                                                    style={{ background: "none", border: "none", width: "100%", cursor: "pointer" }}
                                                >
                                                    <span className="av">{petAvatar(p, 54)}</span>
                                                    <b>{p.name}</b>
                                                    <span>{p.breed || p.species}</span>
                                                </button>
                                                <label style={{ position: "absolute", top: 8, right: 8, cursor: "pointer" }}>
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        style={{ display: "none" }}
                                                        onChange={(e) => e.target.files[0] && handlePetPhotoSelect(p.id, e.target.files[0])}
                                                    />
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            width: 22,
                                                            height: 22,
                                                            borderRadius: "50%",
                                                            background: T.blue,
                                                            color: "#fff",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        {petPhotoUploading === p.id ? "…" : "✎"}
                                                    </span>
                                                </label>
                                                <button
                                                    className="nvc-btn out sm"
                                                    style={{ width: "100%", marginTop: 10 }}
                                                    onClick={() => openEditPet(p)}
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    {/* ══ ACCOUNT (Pet Owner) ═══════════════════════════════════ */}
                    {section === "owner" && profile && (
                        <>
                            <div className="nvc-phead">
                                <div>
                                    <h1>Account</h1>
                                    <p>{profile.email || profile.phone}</p>
                                </div>
                            </div>
                            <div className="nvc-grid2">
                                <div className="nvc-panel">
                                    <h3>Your details</h3>
                                    {!editingProfile ? (
                                        <>
                                            <div className="nvc-sum" style={{ marginBottom: 16 }}>
                                                <div className="r"><span>Name</span><b>{profile.first_name} {profile.last_name}</b></div>
                                                <div className="r"><span>Email</span><b>{profile.email || "—"}</b></div>
                                                <div className="r"><span>Phone</span><b>{profile.phone || "—"}</b></div>
                                                <div className="r"><span>Emirates ID</span><b>{profile.emirates_id || "—"}</b></div>
                                                <div className="r"><span>Postal Address</span><b>{profile.postal_address || "—"}</b></div>
                                                {showMoreDetails && (
                                                    <>
                                                        <div className="r"><span>Date of birth</span><b>{profile.date_of_birth || "—"}</b></div>
                                                        <div className="r"><span>Passport number</span><b>{profile.passport_number || "—"}</b></div>
                                                        <div className="r"><span>Business name</span><b>{profile.business_name || "—"}</b></div>
                                                        <div className="r"><span>Account status</span><b>{profile.account_status || "—"}</b></div>
                                                    </>
                                                )}
                                            </div>
                                            <div style={{ display: "flex", gap: 10 }}>
                                                <button className="nvc-btn out sm" onClick={() => setShowMoreDetails(!showMoreDetails)}>
                                                    {showMoreDetails ? "Show less" : "Show more details"}
                                                </button>
                                                <button className="nvc-btn sm" onClick={openEditProfile}>Edit details</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="nvc-form-grid2">
                                                <div className="nvc-form-field">
                                                    <label>First name</label>
                                                    <input className="nvc-input" value={profileForm.first_name} onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })} />
                                                </div>
                                                <div className="nvc-form-field">
                                                    <label>Last name</label>
                                                    <input className="nvc-input" value={profileForm.last_name} onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="nvc-form-field">
                                                <label>Phone</label>
                                                <input className="nvc-input" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} />
                                            </div>
                                            <div className="nvc-form-field">
                                                <label>Emirates ID</label>
                                                <input className="nvc-input" value={profileForm.emirates_id} onChange={(e) => setProfileForm({ ...profileForm, emirates_id: e.target.value })} />
                                            </div>
                                            <div className="nvc-form-grid2">
                                                <div className="nvc-form-field">
                                                    <label>Date of birth</label>
                                                    <input className="nvc-input" type="date" value={profileForm.date_of_birth} onChange={(e) => setProfileForm({ ...profileForm, date_of_birth: e.target.value })} />
                                                </div>
                                                <div className="nvc-form-field">
                                                    <label>Passport number</label>
                                                    <input className="nvc-input" value={profileForm.passport_number} onChange={(e) => setProfileForm({ ...profileForm, passport_number: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="nvc-form-field">
                                                <label>Business name</label>
                                                <input className="nvc-input" value={profileForm.business_name} onChange={(e) => setProfileForm({ ...profileForm, business_name: e.target.value })} />
                                            </div>
                                            {profileError && <div className="nvc-error-text">{profileError}</div>}
                                            <div style={{ display: "flex", gap: 10 }}>
                                                <button className="nvc-btn out sm" onClick={() => setEditingProfile(false)}>Cancel</button>
                                                <button className="nvc-btn sm" disabled={profileSaving} onClick={handleSaveProfile}>
                                                    {profileSaving ? "Saving…" : "Save changes"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="nvc-panel">
                                    <h3>Settings</h3>
                                    <a className="nvc-mrow" href={CLINIC_WHATSAPP}>
                                        <span className="ic" style={{ background: "#E4F8EC" }}>
                                            <svg viewBox="0 0 24 24" fill="#25D366"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.8 14.2c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.2-3.2-.7-2.7-1.1-4.4-3.9-4.5-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.6-.3h.5c.2 0 .4 0 .5.4l.8 1.9c.1.2 0 .4-.1.5l-.3.4c-.1.1-.3.3-.1.5.1.3.6 1.1 1.3 1.7.9.8 1.6 1 1.9 1.2.2.1.4 0 .5-.1l.7-.8c.2-.2.3-.1.5-.1l1.8.9c.2.1.4.2.4.3v1.2z" /></svg>
                                        </span>
                                        <b>Message us on WhatsApp</b>
                                        <span className="ar"><ChevronIcon /></span>
                                    </a>
                                    <button className="nvc-mrow" onClick={() => setSection("financials")}>
                                        <span className="ic">{SIDE_ICONS.financials}</span>
                                        <b>Invoices</b>
                                        <span className="ar"><ChevronIcon /></span>
                                    </button>
                                    <button className="nvc-mrow" onClick={handleLogout}>
                                        <span className="ic">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 17l5-5-5-5M21 12H9M12 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" /></svg>
                                        </span>
                                        <b>Sign out</b>
                                        <span className="ar"><ChevronIcon /></span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══ BOOKINGS ═══════════════════════════════════════════════ */}
                    {section === "bookings" && (
                        <>
                            <div className="nvc-phead"><div><h1>Bookings</h1></div></div>
                            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                                <button className={`nvc-subtab ${bookingsSubTab === "upcoming" ? "on" : ""}`} onClick={() => setBookingsSubTab("upcoming")}>Upcoming</button>
                                <button className={`nvc-subtab ${bookingsSubTab === "past" ? "on" : ""}`} onClick={() => setBookingsSubTab("past")}>Past</button>
                            </div>
                            <div className="nvc-panel">
                                {!appointments ? (
                                    <div className="nvc-portal-empty">Loading your bookings…</div>
                                ) : (
                                    <table className="nvc-table">
                                        <thead>
                                            <tr>
                                                <th>S.No</th>
                                                <th>Veterinarian</th>
                                                <th>Appointment Date</th>
                                                <th>Status</th>
                                                <th></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(bookingsSubTab === "upcoming" ? upcomingAppts : pastAppts).length === 0 && (
                                                <tr>
                                                    <td colSpan={5} style={{ textAlign: "center", color: T.muted, padding: "24px 0" }}>
                                                        No {bookingsSubTab} bookings.
                                                    </td>
                                                </tr>
                                            )}
                                            {(bookingsSubTab === "upcoming" ? upcomingAppts : pastAppts).map((a, i) => (
                                                <Fragment key={a.id}>
                                                    <tr className="clk" onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}>
                                                        <td>{i + 1}</td>
                                                        <td style={{ fontWeight: 600 }}>{a.resource_name || "—"}</td>
                                                        <td>
                                                            {fmtDate(a.start_time)}
                                                            <div style={{ color: T.blue, fontSize: 12 }}>{fmtTime(a.start_time)}</div>
                                                        </td>
                                                        <td><StatusBadge status={a.status} /></td>
                                                        <td style={{ color: T.muted }}>{expandedId === a.id ? "▲" : "▼"}</td>
                                                    </tr>
                                                    {expandedId === a.id && (
                                                        <tr>
                                                            <td colSpan={5} style={{ background: T.blueWash }}>
                                                                <div style={{ padding: "10px 4px" }}>
                                                                    <div><strong>Reason:</strong> {a.description || "—"}</div>
                                                                    <div><strong>Pet:</strong> {pets?.find((p) => p.id === a.animal_id)?.name || "—"}</div>
                                                                    {a.location_address && <div><strong>Location:</strong> {a.location_address}</div>}
                                                                    {bookingsSubTab === "upcoming" && !/cancel/i.test(a.status || "") && (
                                                                        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }} onClick={(e) => e.stopPropagation()}>
                                                                            {a.directions_url && (
                                                                                <a className="nvc-btn out sm" href={a.directions_url} target="_blank" rel="noreferrer">Directions</a>
                                                                            )}
                                                                            <button className="nvc-btn out sm" onClick={() => openReschedule(a)}>Reschedule</button>
                                                                            <button
                                                                                className="nvc-btn out sm"
                                                                                onClick={() => handleCancelAppointment(a.id)}
                                                                                disabled={cancellingId === a.id}
                                                                            >
                                                                                {cancellingId === a.id ? "Cancelling…" : "Cancel"}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </>
                    )}

                    {/* ══ FINANCIALS ═════════════════════════════════════════════ */}
                    {section === "financials" && (
                        <>
                            <div className="nvc-phead"><div><h1>Financials</h1></div></div>
                            {!financials ? (
                                <div className="nvc-portal-empty">Loading…</div>
                            ) : (
                                <>
                                    <div className="nvc-fin-cards">
                                        <div className="nvc-fin-card">
                                            <div className="nvc-fin-label">Current balance</div>
                                            <div className="nvc-fin-value" style={{ color: financials.current_balance > 0 ? T.urgent : T.ink }}>
                                                AED {financials.current_balance.toFixed(2)}
                                            </div>
                                        </div>
                                        <div className="nvc-fin-card">
                                            <div className="nvc-fin-label">Spending, last 12 months</div>
                                            <div className="nvc-fin-value">AED {financials.previous_spending_12mo.toFixed(2)}</div>
                                        </div>
                                        <div className="nvc-fin-card">
                                            <div className="nvc-fin-label">Total paid, lifetime</div>
                                            <div className="nvc-fin-value">AED {financials.total_paid_lifetime.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <h3 style={{ fontSize: 15, margin: "8px 0 10px" }}>
                                        Pending Payments {financials.pending_payments.length > 0 && `(${financials.pending_payments.length})`}
                                    </h3>
                                    {financials.pending_payments.length === 0 ? (
                                        <div className="nvc-portal-empty" style={{ padding: "16px 0" }}>No pending payments — you're all settled up.</div>
                                    ) : (
                                        financials.pending_payments.map((inv) => (
                                            <div key={inv.id} className="nvc-pending-row">
                                                <div>
                                                    <div style={{ fontWeight: 600, color: T.ink, fontSize: 13 }}>{inv.description || `Invoice #${inv.id}`}</div>
                                                    <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                                                        Invoiced {fmtDate(inv.date)}{inv.due_date ? ` · Due ${fmtDate(inv.due_date)}` : ""}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 700, color: T.urgent, fontSize: 15 }}>AED {inv.amount_owing.toFixed(2)}</div>
                                            </div>
                                        ))
                                    )}
                                    <h3 style={{ fontSize: 15, margin: "24px 0 10px" }}>Recent Transactions</h3>
                                    {financials.invoices.length === 0 ? (
                                        <div className="nvc-portal-empty">No transactions found.</div>
                                    ) : (
                                        <div className="nvc-panel" style={{ padding: 0, overflowX: "auto" }}>
                                            <table className="nvc-table" style={{ marginTop: 0 }}>
                                                <thead>
                                                    <tr>
                                                        <th>Date</th>
                                                        <th>Description</th>
                                                        <th>Total</th>
                                                        <th>Paid</th>
                                                        <th>Owing</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {financials.invoices.map((inv) => (
                                                        <tr key={inv.id}>
                                                            <td>{fmtDate(inv.date)}</td>
                                                            <td>{inv.description || "Invoice"}</td>
                                                            <td>AED {inv.total.toFixed(2)}</td>
                                                            <td>AED {inv.amount_paid.toFixed(2)}</td>
                                                            <td style={{ color: inv.amount_owing > 0 ? T.urgent : T.ink, fontWeight: inv.amount_owing > 0 ? 700 : 400 }}>
                                                                AED {inv.amount_owing.toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </main>
            </div>

            <nav className="nvc-bottomtabs">
                {NAV_ITEMS.map((item) => (
                    <button
                        key={item.key}
                        className={section === item.key ? "on" : ""}
                        onClick={() => (item.action ? item.action() : (setSection(item.key), setHealthOverviewPetId(null)))}
                    >
                        {SIDE_ICONS[item.key]}
                        {MOBILE_TAB_LABELS[item.key]}
                    </button>
                ))}
            </nav>

            {rescheduleModal && (
                <Modal onClose={() => setRescheduleModal(null)}>
                    <button className="nvc-modal-close" onClick={() => setRescheduleModal(null)}>×</button>
                    <div className="nvc-modal-title">Reschedule appointment</div>
                    <div style={{ height: 4 }} />
                    <p style={{ color: T.muted, fontSize: 14, margin: "0 0 16px" }}>
                        {rescheduleModal.description || "Appointment"} · currently {fmtDate(rescheduleModal.start_time)}, {fmtTime(rescheduleModal.start_time)}
                    </p>

                    <div className="nvc-form-field">
                        <label>New date</label>
                        <input
                            className="nvc-input"
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={rescheduleDate}
                            onChange={(e) => setRescheduleDate(e.target.value)}
                        />
                    </div>

                    {rescheduleModal.slot_check_available ? (
                        <div style={{ marginTop: 14 }}>
                            <label style={{ fontSize: 13, fontWeight: 600, color: T.ink, display: "block", marginBottom: 8 }}>Available times</label>
                            {rescheduleSlotsLoading ? (
                                <div className="nvc-portal-empty">Loading times…</div>
                            ) : !rescheduleSlots || rescheduleSlots.length === 0 ? (
                                <div className="nvc-portal-empty">No available times that day — try another date.</div>
                            ) : (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {rescheduleSlots.map((s) => (
                                        <button
                                            key={s.start_iso}
                                            className="nvc-btn out sm"
                                            disabled={rescheduleSaving}
                                            onClick={() => submitReschedule(s.start_iso)}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="nvc-form-field" style={{ marginTop: 14 }}>
                                <label>New time</label>
                                <input
                                    className="nvc-input"
                                    type="time"
                                    value={rescheduleManualTime}
                                    onChange={(e) => setRescheduleManualTime(e.target.value)}
                                />
                            </div>
                            <p style={{ color: T.muted, fontSize: 12.5, margin: "6px 0 0" }}>
                                We'll request this time and the clinic will confirm it's available.
                            </p>
                            <button
                                className="nvc-btn full"
                                style={{ marginTop: 16 }}
                                disabled={!rescheduleDate || !rescheduleManualTime || rescheduleSaving}
                                onClick={() => submitReschedule(`${rescheduleDate}T${rescheduleManualTime}:00`)}
                            >
                                {rescheduleSaving ? "Saving…" : "Request this time"}
                            </button>
                        </>
                    )}

                    {rescheduleError && <p style={{ color: T.urgent, fontSize: 13.5, marginTop: 12 }}>{rescheduleError}</p>}
                </Modal>
            )}

            {petModal && (
                <Modal onClose={() => setPetModal(null)}>
                    <button className="nvc-modal-close" onClick={() => setPetModal(null)}>×</button>
                    <div className="nvc-modal-title">{petModal === "add" ? "Add a pet" : "Edit pet"}</div>
                    <div style={{ height: 16 }} />
                    <div className="nvc-form-field">
                        <label>Pet's name</label>
                        <input className="nvc-input" value={petForm.name} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} />
                    </div>
                    <div className="nvc-form-grid2">
                        <div className="nvc-form-field">
                            <label>Species</label>
                            <select className="nvc-input" value={petForm.species_id} onChange={(e) => handleSpeciesChange(e.target.value)}>
                                <option value="">Select…</option>
                                {petOptions.species.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="nvc-form-field">
                            <label>Sex</label>
                            <select className="nvc-input" value={petForm.sex_id} onChange={(e) => setPetForm({ ...petForm, sex_id: e.target.value })}>
                                <option value="">Select…</option>
                                {petOptions.sexes.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="nvc-form-grid2">
                        <div className="nvc-form-field">
                            <label>Breed</label>
                            <select
                                className="nvc-input"
                                value={petForm.breed_id}
                                onChange={(e) => setPetForm({ ...petForm, breed_id: e.target.value })}
                                disabled={!petForm.species_id}
                            >
                                <option value="">{petForm.species_id ? "Select…" : "Select species first"}</option>
                                {petOptions.breeds.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="nvc-form-field">
                            <label>Colour</label>
                            <select className="nvc-input" value={petForm.colour_id} onChange={(e) => setPetForm({ ...petForm, colour_id: e.target.value })}>
                                <option value="">Select…</option>
                                {petOptions.colours.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="nvc-form-field">
                        <label>Date of birth</label>
                        <input className="nvc-input" type="date" value={petForm.dob} onChange={(e) => setPetForm({ ...petForm, dob: e.target.value })} />
                    </div>
                    {petOptionsLoading && <div style={{ fontSize: 12, color: T.muted, marginBottom: 10 }}>Loading options…</div>}
                    {petError && <div className="nvc-error-text" style={{ marginBottom: 10 }}>{petError}</div>}
                    <button className="nvc-btn full" disabled={petSaving} onClick={handleSavePet}>
                        {petSaving ? "Saving…" : petModal === "add" ? "Add pet" : "Save changes"}
                    </button>
                </Modal>
            )}

            {toast && <div className="nvc-toast">{toast}</div>}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// TOP-LEVEL EXPORT — toggles between the booking wizard and the account portal
// ═══════════════════════════════════════════════════════════════════════════

export default function BookingFlow() {
    const [view, setView] = useState("booking") // "booking" | "account"

    return (
        <>
            {view === "booking" ? (
                <BookingWizard onGoToAccount={() => setView("account")} />
            ) : (
                <AccountPortal onBackToBooking={() => setView("booking")} />
            )}
        </>
    )
}