/**
 * LiveRoomPage — NovaSound TITAN LUX V110000
 *
 * ✅ V100000 — Sync audio, playlist, file locale, réactions, typing, WakeLock
 * ✅ V110000 — Fix zone de saisie mobile (BottomNav masqué = input visible)
 * ✅ V110000 — Notifications join/leave remplacées par floating toast discret
 * ✅ V110000 — Zone réaction : fermeture manuelle (croix) + pas d'auto-close
 * ✅ V110000 — Pause/Resume live par l'hôte + broadcast aux auditeurs
 * ✅ V110000 — Partage du lien en live dans le chat global
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import { ALL_GENRES } from '@/hooks/useGenreTheme';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayer } from '@/contexts/PlayerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import LiveLikeButton from '@/components/LiveLikeButton';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { notifyFollowers, notifyUser, notifyMentions, notifyAll } from '@/lib/notifUtils';
import NoTranslate from '@/components/NoTranslate';
import {
  Radio, Users, Music, Send, Heart, Crown, Copy, Check, Plus, Lock, Unlock,
  Headphones, Zap, X, ArrowLeft, Loader2, WifiOff, RefreshCw, Search, Upload,
  Pencil, Trash2, CheckCircle2, XCircle, Play, ListMusic, SkipForward, LogOut,
  Smile, Share2, AlertCircle, Clock, Volume2, ChevronUp, BookOpen, Pause,
  MessageCircle, AtSign,
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════════════
   CSS BRAND EFFECTS
   ══════════════════════════════════════════════════════════════════════════ */
const BRAND_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Syne:wght@400;600;700;800&display=swap');

  /* ── Keyframes ── */
  @keyframes brandShimmer {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes auroraShift {
    0%   { background-position: 0% 50%; }
    50%  { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes brandGlow {
    0%,100%{ filter: drop-shadow(0 0 8px rgba(6,182,212,0.8)) drop-shadow(0 0 20px rgba(6,182,212,0.4)); }
    50%    { filter: drop-shadow(0 0 12px rgba(168,85,247,0.9)) drop-shadow(0 0 30px rgba(168,85,247,0.5)); }
  }
  @keyframes brandScan {
    0%   { transform: translateX(-110%); }
    100% { transform: translateX(210%); }
  }
  @keyframes brandDot {
    0%,100%{ opacity:1; transform:scale(1); box-shadow:0 0 6px #22d3ee,0 0 12px rgba(6,182,212,0.6); }
    50%    { opacity:0.5; transform:scale(0.7); box-shadow:0 0 3px #a855f7; }
  }
  @keyframes particleFloat {
    0%,100%{ transform:translateY(0) translateX(0); opacity:0.7; }
    33%    { transform:translateY(-8px) translateX(4px); opacity:1; }
    66%    { transform:translateY(-4px) translateX(-3px); opacity:0.5; }
  }
  @keyframes pulseRing {
    0%   { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.8); opacity: 0; }
  }
  @keyframes livebeat {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.4; transform: scale(0.85); }
  }
  @keyframes msgSlide {
    from { opacity: 0; transform: translateY(6px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes borderGlow {
    0%, 100% { border-color: rgba(6,182,212,0.2); box-shadow: 0 0 0 rgba(6,182,212,0); }
    50%      { border-color: rgba(168,85,247,0.35); box-shadow: 0 0 20px rgba(168,85,247,0.08); }
  }
  @keyframes scanH {
    0%   { transform: translateY(-100%); }
    100% { transform: translateY(600%); }
  }
  @keyframes npWave {
    0%,100% { height: 4px; }
    50%     { height: 18px; }
  }
  @keyframes fadeUp {
    from { opacity:0; transform: translateY(12px); }
    to   { opacity:1; transform: translateY(0); }
  }

  /* ── Global typography ── */
  .lr-ui { font-family: 'Syne', system-ui, sans-serif; }

  /* ── Brand ── */
  .nova-brand {
    font-family: 'Orbitron', monospace;
    font-weight: 900;
    letter-spacing: 0.14em;
    background: linear-gradient(90deg,#22d3ee 0%,#a855f7 35%,#f0abfc 55%,#22d3ee 80%,#06b6d4 100%);
    background-size: 250% 100%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: brandShimmer 3.5s ease infinite, brandGlow 3s ease-in-out infinite;
  }
  .nova-brand-sm { font-size: clamp(13px, 3.5vw, 18px); }
  .nova-brand-lg { font-size: 13px; }
  .nova-scan-line {
    position: absolute; top:0; left:0; right:0; bottom:0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
    animation: brandScan 4s ease-in-out infinite;
    pointer-events: none; border-radius: inherit; overflow: hidden;
  }
  .nova-dot {
    display: inline-block; width:6px; height:6px; border-radius:50%;
    background: #22d3ee;
    animation: brandDot 1.5s ease-in-out infinite;
  }
  .nova-particle {
    position: absolute; width:3px; height:3px; border-radius:50%;
    animation: particleFloat ease-in-out infinite;
  }

  /* ── Page background ── */
  .lr-bg {
    background: #03030d;
    min-height: 100vh;
    position: relative;
    overflow: hidden;
  }
  .lr-bg::before {
    content: '';
    position: fixed; inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 15% 10%, rgba(6,182,212,0.07) 0%, transparent 60%),
      radial-gradient(ellipse 60% 40% at 85% 20%, rgba(168,85,247,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 50% 60% at 50% 90%, rgba(6,182,212,0.04) 0%, transparent 55%);
    pointer-events: none; z-index: 0;
    animation: auroraShift 12s ease infinite;
  }
  .lr-bg > * { position: relative; z-index: 1; }

  /* ── Top bar ── */
  .lr-topbar {
    background: rgba(3,3,18,0.88);
    backdrop-filter: blur(32px) saturate(2);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    position: relative;
  }
  .lr-topbar::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.4) 30%, rgba(168,85,247,0.4) 70%, transparent 100%);
  }

  /* ── Brand bar mobile ── */
  .nova-mobile-bar {
    position: relative; overflow: hidden;
    background: linear-gradient(135deg, rgba(6,182,212,0.05) 0%, rgba(168,85,247,0.05) 100%);
  }
  .nova-mobile-bar::before {
    content:''; position:absolute; bottom:0; left:0; right:0; height:1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.5), rgba(168,85,247,0.5), transparent);
  }

  /* ── Now Playing ── */
  .lr-nowplaying {
    background: rgba(3,3,18,0.92);
    backdrop-filter: blur(24px) saturate(1.8);
    border-bottom: 1px solid rgba(6,182,212,0.1);
    position: relative;
    animation: borderGlow 4s ease-in-out infinite;
  }
  .lr-nowplaying::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.6), rgba(168,85,247,0.3), transparent);
  }

  /* ── Chat area ── */
  .lr-chat-bg {
    background: transparent;
  }

  /* ── Message bubbles ── */
  .lr-msg-mine {
    background: linear-gradient(135deg, rgba(6,182,212,0.9) 0%, rgba(139,92,246,0.85) 100%);
    box-shadow: 0 4px 20px rgba(6,182,212,0.2), inset 0 1px 0 rgba(255,255,255,0.15);
    animation: msgSlide 0.2s ease-out;
  }
  .lr-msg-other {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(12px);
    box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    animation: msgSlide 0.2s ease-out;
  }

  /* ── Input area ── */
  .lr-input-zone {
    background: rgba(3,3,18,0.95);
    backdrop-filter: blur(32px);
    border-top: 1px solid rgba(255,255,255,0.06);
    position: relative;
  }
  .lr-input-zone::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.3), rgba(168,85,247,0.3), transparent);
  }
  .lr-textarea {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.08) !important;
    font-family: 'Syne', system-ui, sans-serif !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
  }
  .lr-textarea:focus {
    border-color: rgba(6,182,212,0.4) !important;
    box-shadow: 0 0 0 3px rgba(6,182,212,0.06) !important;
  }

  /* ── Side panel ── */
  .lr-side {
    background: rgba(5,5,20,0.92);
    backdrop-filter: blur(28px) saturate(1.6);
    border-left: 1px solid rgba(255,255,255,0.05);
  }
  .lr-side-tab-active {
    background: rgba(6,182,212,0.1);
    color: #22d3ee;
    border-bottom: 2px solid #22d3ee;
  }

  /* ── Participant card ── */
  .lr-participant {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.05);
    transition: all 0.2s;
  }
  .lr-participant:hover {
    background: rgba(6,182,212,0.06);
    border-color: rgba(6,182,212,0.15);
  }

  /* ── Host controls card ── */
  .lr-ctrl-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 16px;
    padding: 16px;
    animation: borderGlow 5s ease-in-out infinite;
  }
  .lr-ctrl-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.75);
    transition: all 0.2s;
    font-family: 'Syne', system-ui, sans-serif;
  }
  .lr-ctrl-btn:hover {
    background: rgba(6,182,212,0.08);
    border-color: rgba(6,182,212,0.25);
    color: #22d3ee;
  }
  .lr-ctrl-btn-danger {
    background: rgba(239,68,68,0.07);
    border: 1px solid rgba(239,68,68,0.2);
    color: #f87171;
    transition: all 0.2s;
    font-family: 'Syne', system-ui, sans-serif;
  }
  .lr-ctrl-btn-danger:hover {
    background: rgba(239,68,68,0.15);
    border-color: rgba(239,68,68,0.4);
  }

  /* ── Live badge ── */
  .lr-live-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: rgba(34,197,94,0.1);
    border: 1px solid rgba(34,197,94,0.3);
    padding: 2px 8px; border-radius: 99px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    color: #4ade80; font-family: 'Orbitron', monospace;
  }
  .lr-live-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #4ade80;
    animation: livebeat 1s ease-in-out infinite;
    box-shadow: 0 0 6px #4ade80;
  }

  /* ── Queue item ── */
  .lr-queue-active {
    background: rgba(6,182,212,0.07);
    border: 1px solid rgba(6,182,212,0.18);
  }
  .lr-queue-item {
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.18s;
  }
  .lr-queue-item:hover {
    background: rgba(255,255,255,0.04);
    border-color: rgba(255,255,255,0.07);
  }

  /* ── Info card ── */
  .lr-info-card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 14px;
    padding: 14px;
  }

  /* ── System message ── */
  .lr-sys-msg {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; margin: 6px 0;
  }
  .lr-sys-line {
    flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent);
  }
  .lr-sys-text {
    font-size: 11px; color: rgba(255,255,255,0.3);
    padding: 2px 10px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 99px;
    font-family: 'Syne', system-ui, sans-serif;
  }

  /* ── Scan lines overlay ── */
  .lr-scanlines::after {
    content: '';
    position: absolute; inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px);
    pointer-events: none; z-index: 10;
  }

  /* ── EQ bars ── */
  .lr-np-bar {
    display: inline-block;
    width: 3px; border-radius: 2px;
    background: linear-gradient(to top, #06b6d4, #a855f7);
    animation: npWave ease-in-out infinite;
  }

  /* ── Empty state ── */
  .lr-empty-icon {
    width: 64px; height: 64px; border-radius: 20px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px;
  }

  /* ── Room card (lobby) ── */
  .lr-room-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(34,197,94,0.15);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.22s;
    position: relative;
  }
  .lr-room-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(34,197,94,0.4), transparent);
  }
  .lr-room-card:hover {
    border-color: rgba(34,197,94,0.35);
    background: rgba(34,197,94,0.04);
    transform: translateY(-3px);
    box-shadow: 0 12px 40px rgba(34,197,94,0.08);
  }

  /* ── Mobile bottom sheet ── */
  .lr-sheet {
    background: rgba(5,5,22,0.97);
    backdrop-filter: blur(32px);
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  /* ── Confirm modal ── */
  .lr-modal {
    background: rgba(8,8,28,0.98);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(32px);
    border-radius: 24px;
    box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
  }


  /* ── Top bar glass (active room) ── */
  .room-glass-bar {
    background: rgba(3,3,18,0.92);
    backdrop-filter: blur(32px) saturate(2);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    position: relative;
  }
  .room-glass-bar::after {
    content: '';
    position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.5) 30%, rgba(168,85,247,0.5) 70%, transparent 100%);
  }

  /* ── Now Playing glass bar ── */
  .nowplaying-glass {
    background: linear-gradient(135deg, rgba(6,182,212,0.06) 0%, rgba(168,85,247,0.04) 100%);
    backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(6,182,212,0.12);
    position: relative;
    box-shadow: inset 0 -1px 0 rgba(168,85,247,0.08);
  }
  .nowplaying-glass::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.7), rgba(168,85,247,0.4), transparent);
    animation: borderGlow 4s ease-in-out infinite;
  }

  /* ── Side panel redesign ── */
  .lr-side {
    background: rgba(4,4,18,0.96);
    backdrop-filter: blur(32px) saturate(1.6);
    border-left: 1px solid rgba(255,255,255,0.05);
  }
  .lr-side-tabs {
    background: rgba(3,3,15,0.8);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    padding: 8px;
    gap: 4px;
    display: flex;
  }
  .lr-side-tab {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    gap: 4px; padding: 8px 4px; border-radius: 12px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.02em;
    color: rgba(255,255,255,0.35);
    transition: all 0.18s; cursor: pointer; border: 1px solid transparent;
  }
  .lr-side-tab:hover {
    background: rgba(255,255,255,0.04);
    color: rgba(255,255,255,0.6);
  }
  .lr-side-tab.active-participants {
    background: rgba(34,197,94,0.08);
    border-color: rgba(34,197,94,0.2);
    color: #4ade80;
  }
  .lr-side-tab.active-queue {
    background: rgba(6,182,212,0.08);
    border-color: rgba(6,182,212,0.2);
    color: #22d3ee;
  }
  .lr-side-tab.active-controls {
    background: rgba(168,85,247,0.08);
    border-color: rgba(168,85,247,0.2);
    color: #c084fc;
  }

  /* ── Participant card redesign ── */
  .lr-participant {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 14px;
    padding: 8px 10px;
    transition: all 0.18s;
    display: flex; align-items: center; gap: 10px;
  }
  .lr-participant:hover {
    background: rgba(34,197,94,0.05);
    border-color: rgba(34,197,94,0.12);
  }
  .lr-participant.is-host {
    background: rgba(251,191,36,0.04);
    border-color: rgba(251,191,36,0.12);
  }

  /* ── Host control buttons redesign ── */
  .lr-ctrl-card {
    background: rgba(168,85,247,0.04);
    border: 1px solid rgba(168,85,247,0.12);
    border-radius: 16px;
    padding: 14px;
    position: relative;
    overflow: hidden;
  }
  .lr-ctrl-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(168,85,247,0.5), transparent);
  }
  .lr-ctrl-btn {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.7);
    transition: all 0.18s;
    font-family: 'Syne', system-ui, sans-serif;
    border-radius: 12px;
    padding: 10px 14px;
    width: 100%;
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600;
  }
  .lr-ctrl-btn:hover {
    background: rgba(6,182,212,0.08);
    border-color: rgba(6,182,212,0.25);
    color: #22d3ee;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(6,182,212,0.1);
  }
  .lr-ctrl-btn-danger {
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.18);
    color: #f87171;
    transition: all 0.18s;
    font-family: 'Syne', system-ui, sans-serif;
    border-radius: 12px;
    padding: 10px 14px;
    width: 100%;
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; font-weight: 600;
  }
  .lr-ctrl-btn-danger:hover {
    background: rgba(239,68,68,0.12);
    border-color: rgba(239,68,68,0.35);
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(239,68,68,0.15);
  }

  /* ── Queue item refined ── */
  .lr-queue-active {
    background: linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(168,85,247,0.05) 100%);
    border: 1px solid rgba(6,182,212,0.2);
    box-shadow: inset 0 0 0 1px rgba(6,182,212,0.05);
  }
  .lr-queue-item {
    background: transparent;
    border: 1px solid transparent;
    transition: all 0.15s;
    border-radius: 12px;
  }
  .lr-queue-item:hover {
    background: rgba(255,255,255,0.03);
    border-color: rgba(255,255,255,0.06);
  }

  /* ── Chat input refined ── */
  .lr-textarea {
    background: rgba(255,255,255,0.04) !important;
    border: 1px solid rgba(255,255,255,0.07) !important;
    font-family: 'Syne', system-ui, sans-serif !important;
    transition: border-color 0.2s, box-shadow 0.2s !important;
    border-radius: 16px !important;
  }
  .lr-textarea:focus {
    border-color: rgba(6,182,212,0.35) !important;
    box-shadow: 0 0 0 3px rgba(6,182,212,0.05) !important;
    background: rgba(6,182,212,0.03) !important;
  }

  /* ── Mobile sheet refined ── */
  .lr-sheet {
    background: linear-gradient(180deg, rgba(6,6,22,0.99) 0%, rgba(4,4,16,1) 100%);
    backdrop-filter: blur(32px);
    border-top: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 -20px 60px rgba(0,0,0,0.6);
  }

  /* ── Confirm modal refined ── */
  .lr-modal {
    background: linear-gradient(160deg, rgba(8,8,28,0.99) 0%, rgba(5,5,20,0.99) 100%);
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(40px);
    border-radius: 24px;
    box-shadow: 0 40px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(6,182,212,0.05);
    overflow: hidden;
    position: relative;
  }
  .lr-modal::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(6,182,212,0.5), rgba(168,85,247,0.4), transparent);
  }

  /* ── Scrollbar hide ── */
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

  /* ── Mentions live chat ── */
  .lr-mention-user {
    display:inline-flex;align-items:center;
    background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(6,182,212,.07));
    border:1px solid rgba(6,182,212,.4);color:#67e8f9;font-weight:800;
    padding:0 7px 1px;border-radius:20px;font-size:.87em;
    cursor:pointer;white-space:nowrap;vertical-align:middle;
    transition:all .15s;
  }
  .lr-mention-user:hover {
    background:linear-gradient(135deg,rgba(6,182,212,.28),rgba(6,182,212,.14));
    border-color:rgba(6,182,212,.7);color:#a5f3fc;
    transform:translateY(-1px);box-shadow:0 4px 12px rgba(6,182,212,.25);
  }
  .lr-mention-all {
    display:inline-flex;align-items:center;gap:3px;
    background:linear-gradient(135deg,rgba(234,179,8,.2),rgba(251,146,60,.1));
    border:1px solid rgba(234,179,8,.45);color:#fde047;font-weight:900;
    padding:0 8px 1px;border-radius:20px;font-size:.87em;
    white-space:nowrap;vertical-align:middle;
    box-shadow:0 2px 10px rgba(234,179,8,.12);
  }
  .lr-mention-self {
    display:inline-flex;align-items:center;
    background:linear-gradient(90deg,rgba(6,182,212,.28),rgba(168,85,247,.22),rgba(236,72,153,.18),rgba(6,182,212,.28));
    background-size:300% 100%;border:1px solid rgba(168,85,247,.5);
    color:#e9d5ff;font-weight:900;padding:0 8px 1px;border-radius:20px;font-size:.87em;
    white-space:nowrap;vertical-align:middle;
    box-shadow:0 2px 12px rgba(168,85,247,.18);
    animation:selfMentionShine 2.5s linear 4;
  }
  @keyframes selfMentionShine{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}

  /* ── Mention popup live ── */
  .lr-mention-popup {
    background:linear-gradient(180deg,rgba(6,6,20,.98) 0%,rgba(4,4,16,.99) 100%);
    border:1px solid rgba(255,255,255,.1);
    backdrop-filter:blur(28px) saturate(1.6);
    box-shadow:0 -16px 48px rgba(0,0,0,.7),0 0 0 1px rgba(6,182,212,.07);
    border-radius:16px;overflow:hidden;
  }
`;

/* ══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ══════════════════════════════════════════════════════════════════════════ */
const MAX_PARTICIPANTS = 50;
const SYNC_MS          = 2500;
const HEARTBEAT_MS     = 25000;
const TYPING_TIMEOUT   = 3000;
const SYNC_THRESHOLD   = 2.0; // secondes d'écart avant recalibration
const REACTION_EMOJIS  = ['🔥','💜','🎵','✨','🎶','❤️','💫','🎉','😍','🚀','👏','🤩','💎','🎸','🥁','🎤'];

// Descriptions personnalisées par genre musical
const GENRE_DESCRIPTIONS = {
  'bikutsi': '🔥 Plonge dans l\'énergie effrénée du Bikutsi camerounais ! Rythmes endiablés et danse traditionnelle beti.',
  'makossa': '🌍 Voyage au cœur de la Makossa, le son qui a conquis le monde. Groove doux et mélodies envoûtantes.',
  'assiko': '🌿 Laisse-toi porter par les rythmes traditionnels Assiko du littoral camerounais. Ambiance nature et authenticité.',
  'ambas-bay': '🌊 Découvre les sonorités folkloriques Yabassi. Musique authentique des rivières et traditions ancestrales.',
  'benskin': '🎭 Fusion unique entre traditions camerounaises et influences modernes. Le son urbain de Douala.',
  'mbole': '🥁 Rythmes puissants de la forêt équatoriale. Énergie brute et chants traditionnels Bantou.',
  'afrobeats': '🎵 Le son qui fait vibrer l\'Afrique ! Fusion moderne de rythmes traditionnels et influences urbaines.',
  'hip-hop': '🎤 Culture urbaine et flows puissants. Beats qui marquent l\'histoire et paroles qui font réfléchir.',
  'r&b': '💜 Sensualité et mélodies douces. Le son qui fait vibrer les cœurs.',
  'pop': '⭐ Hits radio et mélodies entraînantes. La musique qui plaît à tous.',
  'electronique': '🎧 Futurisme et beats synthétiques. L\'énergie de la nuit et des festivals.',
  'trap': '🔥 Basses lourdes et 808 puissants. Le son des rues et des clubs.',
  'gospel': '🙌 Musique sacrée et voix puissantes. Élévation spirituelle et harmonie.',
  'jazz': '🎺 Improvisation et sophistication. Le son chic des salles de concert.',
  'reggae': '🌺 Rythmes jamaïcains et messages positifs. Peace & Love.',
  'dancehall': '🔥 Énergie des tropiques et vibrations. Le son qui fait bouger les corps.',
  'amapiano': '🎹 Piano log et basses profondes. Le son d\'Afrique du Sud qui conquiert le monde.',
  'coupe-decale': '🎵 Côte d\'Ivoire et rythmes entraînants. Le son qui fait danser l\'Afrique de l\'Ouest.',
  'rock': '🎸 Guitares électriques et énergie brute. Le son de la rébellion.',
  'classique': '🎻 Œuvres intemporelles et orchestres majestueux. La musique des siècles.',
  'folk': '🎸 Acoustique et authenticité. Le son des racines et des histoires.',
  'country': '🤠 Guitares acoustiques et histoires de vie. Le son de l\'Amérique profonde.',
  'latin': '💃 Salsa, reggaeton et rythmes latinos. La passion et la fiesta.',
  'drill': '🔥 Basses sombres et flows rapides. Le son des rues modernes.',
  'outro': '🎯 Expérimental et avant-garde. Le son de demain.',
};
const GRADIENTS        = [
  'from-cyan-500 to-blue-600','from-fuchsia-500 to-purple-600','from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600','from-rose-400 to-pink-600','from-indigo-400 to-violet-600',
  'from-sky-400 to-cyan-600','from-lime-400 to-green-600',
];

const avatarGrad = (id = '') => GRADIENTS[(id.charCodeAt(0) || 0) % GRADIENTS.length];

const relTime = (iso) => {
  if (!iso) return '';
  const d = Date.now() - new Date(iso).getTime();
  if (d < 60000) return 'instant';
  if (d < 3600000) return Math.floor(d / 60000) + 'm';
  return Math.floor(d / 3600000) + 'h';
};

const fmtDuration = (secs) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return m + ':' + String(s).padStart(2, '0');
};

/* ══════════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANTS
   ══════════════════════════════════════════════════════════════════════════ */

const Avatar = ({ user, size = 9, crown = false, pulse = false }) => {
  const initials = (user?.username || '?').slice(0, 2).toUpperCase();
  const grad = avatarGrad(user?.id || '');
  return (
    <div className={`relative w-${size} h-${size} rounded-full bg-gradient-to-br ${grad} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 border border-white/10`}>
      {user?.avatar_url
        ? <img src={user.avatar_url} alt={initials} className="w-full h-full rounded-full object-cover" />
        : <span className="select-none">{initials}</span>
      }
      {crown && <div className="absolute -top-2 -right-1.5 text-sm select-none drop-shadow">👑</div>}
      {pulse && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-gray-900" />}
    </div>
  );
};

const Eq = ({ active = true, color = 'cyan' }) => {
  const bars = [0.4, 0.7, 1, 0.6, 0.85];
  const c = { cyan: 'bg-cyan-400', fuchsia: 'bg-fuchsia-400', green: 'bg-green-400' }[color] || 'bg-cyan-400';
  return (
    <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
      {bars.map((h, i) => (
        <motion.div key={i} className={`w-0.5 rounded-full ${c}`}
          animate={active ? { height: [(h*100)+'%', '20%', (h*80)+'%', '100%', (h*100)+'%'] } : { height: '20%' }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
          style={{ height: '20%' }} />
      ))}
    </div>
  );
};

const EmojiBurst = ({ bursts }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    <AnimatePresence>
      {bursts.map(b => (
        <motion.div key={b.id} initial={{ opacity: 1, y: 0, scale: 0.6 }} animate={{ opacity: 0, y: -140, scale: 2 }}
          exit={{ opacity: 0 }} transition={{ duration: 1.8, ease: 'easeOut' }}
          className="absolute text-3xl select-none" style={{ left: b.x, bottom: 20 }}>
          {b.emoji}
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

const TypingDots = () => (
  <div className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
    {[0, 1, 2].map(i => (
      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
    ))}
  </div>
);

const ConnBadge = ({ status }) => {
  const cfg = {
    connected:  { label: 'Connecté',   dot: 'bg-green-400',              cls: 'bg-green-500/10 border-green-500/30 text-green-400' },
    connecting: { label: 'Connexion…', dot: 'bg-yellow-400 animate-pulse', cls: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' },
    error:      { label: 'Déconnecté', dot: 'bg-red-400',                 cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    idle:       { label: 'Inactif',    dot: 'bg-gray-400',                cls: 'bg-gray-800 border-gray-700 text-gray-400' },
  }[status] || { label: status, dot: 'bg-gray-400', cls: 'bg-gray-800 border-gray-700 text-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium border ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </span>
  );
};

/* Card dans le lobby */
const RoomCard = ({ room, onJoin }) => {
  const full = (room.participants_count || 0) >= MAX_PARTICIPANTS;
  const pct  = Math.min((room.participants_count || 0) / MAX_PARTICIPANTS, 1);
  return (
    <motion.div
      whileHover={{ scale: full ? 1 : 1.02, y: full ? 0 : -3 }}
      whileTap={{ scale: full ? 1 : 0.97 }}
      onClick={() => !full && onJoin(room.id)}
      className={`relative rounded-3xl p-5 overflow-hidden transition-all ${full ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        background: 'rgba(255,255,255,.04)',
        border: full ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(34,197,94,.18)',
        backdropFilter: 'blur(20px)',
        boxShadow: full ? 'none' : '0 4px 32px rgba(34,197,94,.08)',
      }}>
      {/* Glow bg */}
      {!full && <div className="absolute inset-0 opacity-5" style={{background:'radial-gradient(circle at 30% 30%,rgba(34,197,94,.8) 0%,transparent 60%)'}}/>}

      {/* Live badge */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
        style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.25)'}}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
        </span>
        <span className="text-[10px] text-green-400 font-bold tracking-widest">LIVE</span>
      </div>

      {/* Host */}
      <div className="flex items-center gap-3 mb-4 pr-16">
        <Avatar user={room.host} size={10} crown />
        <div className="min-w-0">
          <h3 className="text-white font-black text-base truncate">{room.title || room.name}</h3>
          <p className="text-xs text-gray-500 truncate">par {room.host?.username || 'Anonyme'}</p>
        </div>
      </div>

      {/* Now playing */}
      {room.current_song && (
        <div className="flex items-center gap-2 mb-4 p-2.5 rounded-2xl"
          style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.06)'}}>
          <Eq active={!full} />
          <div className="min-w-0">
            <p className="text-xs text-white truncate font-semibold notranslate" translate="no">{room.current_song.title}</p>
            <NoTranslate tag="p" className="text-xs text-gray-500 truncate notranslate truncate" translate="no">{room.current_song.artist}</NoTranslate>
          </div>
        </div>
      )}

      {/* Genre */}
      {room.genre && room.genre !== 'music' && (
        <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-3"
          style={{background:'rgba(6,182,212,.1)',border:'1px solid rgba(6,182,212,.2)',color:'#22d3ee'}}>
          {room.genre}
        </span>
      )}

      {/* Participants bar */}
      <div className="flex justify-between text-[10px] text-gray-600 mb-1.5">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{room.participants_count || 0} / {MAX_PARTICIPANTS}</span>
        <span className={full ? 'text-red-400 font-semibold' : ''}>{full ? '🔴 Salle pleine' : `${MAX_PARTICIPANTS - (room.participants_count || 0)} places libres`}</span>
      </div>
      <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.06)'}}>
        <motion.div
          className={`h-full rounded-full ${full ? 'bg-red-500' : 'bg-gradient-to-r from-green-400 to-cyan-400'}`}
          initial={{ width: 0 }} animate={{ width: (pct * 100) + "%" }} transition={{ duration: 0.8 }} />
      </div>

      {/* CTA */}
      {!full && (
        <div className="mt-3 text-center">
          <span className="text-xs text-green-400 font-semibold">Rejoindre →</span>
        </div>
      )}
    </motion.div>
  );
};

/* Item de la file d'attente */
const QueueItem = ({ song, index, isHost, isNowPlaying, onPlay, onRemove }) => (
  <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
    className={`flex items-center gap-3 p-2.5 rounded-xl group transition-all ${isNowPlaying ? 'lr-queue-active' : 'lr-queue-item'}`}>
    <span className="w-5 text-gray-600 text-xs font-mono flex-shrink-0 text-center">
      {isNowPlaying ? (
        <div className="flex items-end gap-[2px] h-4 justify-center">
          {[0,1,2].map(i => (
            <div key={i} className="lr-np-bar w-[3px]" style={{animationDuration:`${0.7+i*0.15}s`,animationDelay:`${i*0.1}s`,height:'4px'}}/>
          ))}
        </div>
      ) : index + 1}
    </span>
    {song.cover_url
      ? <img src={song.cover_url} alt={song.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
      : <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'rgba(255,255,255,0.05)'}}><Music className="w-4 h-4" style={{color:'rgba(255,255,255,0.3)'}} /></div>
    }
    <div className="flex-1 min-w-0">
      <p className={`text-xs font-semibold truncate ${isNowPlaying ? 'text-cyan-300' : 'text-white'}`}><NoTranslate className="truncate"><NoTranslate className="truncate">{song.title}</NoTranslate></NoTranslate></p>
      <p className="text-[10px] truncate" style={{color:'rgba(255,255,255,0.3)'}}><NoTranslate className="truncate"><NoTranslate className="truncate">{song.artist}</NoTranslate></NoTranslate></p>
    </div>
    {isHost && (
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {!isNowPlaying && <button onClick={() => onPlay(song)} className="p-1.5 rounded-lg transition-all hover:bg-cyan-500/10 text-gray-600 hover:text-cyan-400"><Play className="w-3.5 h-3.5" /></button>}
        <button onClick={() => onRemove(song.id)} className="p-1.5 rounded-lg transition-all hover:bg-red-500/10 text-gray-600 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
      </div>
    )}
  </motion.div>
);

/* ── Rendu du contenu avec mentions colorées ── */
const LR_ALL_KEYWORDS = ['@tous','@all','@everyone','@todo','@todos','@tutti','@allen','@alle'];

const renderLiveContent = (text, currentUsername, participants = []) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className="text-cyan-400 underline underline-offset-2 break-all hover:text-cyan-300 transition-colors"
        onClick={e => e.stopPropagation()}>{part}</a>;
    }
    const mentionRegex = /(@[\w-]+)/g;
    const subParts = part.split(mentionRegex);
    return subParts.map((sub, j) => {
      const subKey = i + '-' + j;
      if (!sub.startsWith('@')) return <span key={subKey}>{sub}</span>;
      const lower = sub.toLowerCase();
      const isAll = LR_ALL_KEYWORDS.includes(lower);
      if (isAll) return (
        <span key={subKey}
          className="inline-flex items-center gap-1 font-black px-2.5 py-0.5 rounded-full text-[0.85em] align-middle whitespace-nowrap"
          style={{background:'rgba(234,179,8,.18)',border:'1px solid rgba(234,179,8,.42)',color:'#fde047',boxShadow:'0 2px 10px rgba(234,179,8,.15)'}}>
          📢{sub}
        </span>
      );
      const isSelf = currentUsername && sub.slice(1).toLowerCase() === currentUsername.toLowerCase();
      if (isSelf) return (
        <span key={subKey}
          className="inline-flex items-center font-black px-2.5 py-0.5 rounded-full text-[0.85em] align-middle whitespace-nowrap"
          style={{background:'linear-gradient(90deg,rgba(6,182,212,.25),rgba(168,85,247,.2),rgba(6,182,212,.25))',backgroundSize:'300% 100%',border:'1px solid rgba(168,85,247,.5)',color:'#e9d5ff',boxShadow:'0 2px 12px rgba(168,85,247,.22)',animation:'selfMentionShine 2.5s linear 4'}}>
          {sub}
        </span>
      );
      // Chercher le participant dans la liste pour lien de profil direct
      const participant = participants.find(p => p.username?.toLowerCase() === sub.slice(1).toLowerCase());
      const profileHref = participant
        ? '/#/artist/' + participant.id
        : '/#/search?q=' + encodeURIComponent(sub.slice(1)) + '&type=artists';
      return (
        <a key={subKey}
          href={profileHref}
          className="inline-flex items-center font-black px-2.5 py-0.5 rounded-full text-[0.85em] align-middle whitespace-nowrap transition-all hover:scale-105 hover:brightness-125"
          style={{background:'rgba(6,182,212,.13)',border:'1px solid rgba(6,182,212,.4)',color:'#67e8f9',boxShadow:'0 2px 10px rgba(6,182,212,.12)'}}
          onClick={e => e.stopPropagation()}>
          @{sub.slice(1)}
        </a>
      );
    });
  });
};

/* Message de chat */
const ChatMsg = ({ m, isMine, currentUserId, currentUsername, participants, isEditing, editContent, onStartEdit, onSaveEdit, onCancelEdit, onDelete, onChangeEdit }) => (
  <motion.div layout initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2, ease: 'easeOut' }}
    className={`flex gap-2.5 ${isMine ? 'justify-end' : 'justify-start'} group`}>
    {!isMine && (
      <div className="flex-shrink-0 mt-0.5">
        <Avatar user={m.user} size={7} pulse />
      </div>
    )}
    <div className={`max-w-[76%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
      {!isMine && (
        <p className="text-[11px] font-semibold mb-1 ml-1" style={{color:'rgba(6,182,212,0.7)'}}>
          <NoTranslate>{m.user?.username || 'Anonyme'}</NoTranslate>
        </p>
      )}
      <div className={`relative px-4 py-2.5 ${isMine
        ? 'lr-msg-mine text-white rounded-2xl rounded-tr-sm'
        : 'lr-msg-other text-gray-100 rounded-2xl rounded-tl-sm'}`}>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input value={editContent} onChange={e => onChangeEdit(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(); if (e.key === 'Escape') onCancelEdit(); }}
              className="bg-black/20 border border-white/30 rounded-lg px-2 py-1 text-white text-sm w-44 focus:outline-none focus:border-white/60"
              autoFocus />
            <button onClick={onSaveEdit} className="text-green-300 hover:text-green-200 transition-colors"><CheckCircle2 className="w-4 h-4" /></button>
            <button onClick={onCancelEdit} className="text-red-300 hover:text-red-200 transition-colors"><XCircle className="w-4 h-4" /></button>
          </div>
        ) : (
          <>
            <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{renderLiveContent(m.content, currentUsername, participants)}</p>
            {m.is_edited && <p className="text-[10px] opacity-40 mt-0.5 italic">modifié</p>}
          </>
        )}
      </div>
      <div className={`flex items-center gap-2 mt-1 px-1 ${isMine ? 'flex-row-reverse' : ''}`}>
        <span className="text-[10px]" style={{color:'rgba(255,255,255,0.2)'}}>{relTime(m.created_at)}</span>
        {isMine && !isEditing && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
            <button onClick={onStartEdit} className="p-1 rounded-md transition-colors hover:bg-white/10 text-gray-600 hover:text-gray-300"><Pencil className="w-3 h-3" /></button>
            <button onClick={onDelete} className="p-1 rounded-md transition-colors hover:bg-red-500/10 text-gray-600 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
          </div>
        )}
      </div>
    </div>
    {isMine && <div className="flex-shrink-0 mt-0.5"><Avatar user={m.user} size={7} /></div>}
  </motion.div>
);

const SysMsg = ({ text, icon: Icon = Zap }) => (
  <div className="lr-sys-msg">
    <div className="lr-sys-line" />
    <div className="lr-sys-text flex items-center gap-1.5">
      <Icon className="w-3 h-3 opacity-60" />{text}
    </div>
    <div className="lr-sys-line" />
  </div>
);

/* ── BrandHeader — "NovaSound TITAN LUX" avec effets visuels ── */
const BrandHeader = ({ variant = 'mobile' }) => (
  <div className={`nova-mobile-bar flex items-center justify-center ${variant === 'mobile' ? 'py-3' : 'py-3'}`}>
    <div className="nova-particle" style={{ left:'7%', top:'20%', background:'#22d3ee', animationDuration:'3.1s', opacity:0.45 }} />
    <div className="nova-particle" style={{ left:'22%', top:'68%', background:'#a855f7', animationDuration:'2.4s', animationDelay:'0.7s', opacity:0.35 }} />
    <div className="nova-particle" style={{ right:'18%', top:'25%', background:'#06b6d4', animationDuration:'3.8s', animationDelay:'1.2s', opacity:0.45 }} />
    <div className="nova-particle" style={{ right:'6%', top:'58%', background:'#f0abfc', animationDuration:'2.9s', animationDelay:'0.4s', opacity:0.35 }} />
    <div className="relative flex items-center gap-2.5 select-none">
      <span className="nova-dot" />
      <div className="relative overflow-hidden">
        <span className={`nova-brand ${variant === 'mobile' ? 'nova-brand-sm' : 'nova-brand-lg'}`}>
          NovaSound TITAN LUX
        </span>
        <div className="nova-scan-line" />
      </div>
      <span className="nova-dot" style={{ animationDelay: '0.75s' }} />
    </div>
  </div>
);

const LoadingScreen = ({ label = 'Connexion…' }) => (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6">
    <div className="relative w-20 h-20">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-green-500/20 to-cyan-500/20 border border-green-500/20 flex items-center justify-center">
        <Radio className="w-9 h-9 text-green-400" />
      </div>
      <motion.div className="absolute inset-0 rounded-2xl border-2 border-green-500/40"
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
    </div>
    <div className="text-center">
      <p className="text-white font-semibold mb-2">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        {[0, 1, 2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  </div>
);

/* ════════════════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ════════════════════════════════════════════════════════════════════════════ */
const LiveRoomPage = () => {
  const { roomId: roomIdParam } = useParams();
  const { currentUser }        = useAuth();
  const { playSong, isVisible: playerVisible, currentSong: playerSong } = usePlayer();
  const navigate               = useNavigate();

  /* Phases */
  const [phase, setPhase]               = useState('init');
  const [rooms, setRooms]               = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [room, setRoom]                 = useState(null);
  const [channelStatus, setChannelStatus] = useState('idle');
  const [joinError, setJoinError]       = useState(null);

  /* Live */
  const [participants, setParticipants] = useState([]);
  const [messages, setMessages]         = useState([]);
  const [msgInput, setMsgInput]         = useState('');
  const [mentionUsers,  setMentionUsers]  = useState([]);
  const [showMention,   setShowMention]   = useState(false);
  const [showMentionAll, setShowMentionAll] = useState(false);
  const msgInputRef = useRef(null);
  const mentionDebounce = useRef(null);
  const [editingMsgId, setEditingMsgId] = useState(null);
  const [editContent, setEditContent]   = useState('');
  const [typingUsers, setTypingUsers]   = useState([]);
  const [nowPlaying, setNowPlaying]     = useState(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [queue, setQueue]               = useState([]);
  const [isHost, setIsHost]             = useState(false);

  /* Lobby / Create */
  const [roomName, setRoomName]         = useState('');
  const [roomDescription, setRoomDescription] = useState('');
  const [roomGenre, setRoomGenre]       = useState('');
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [isPrivate, setIsPrivate]       = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  /* UI */
  const [showPicker, setShowPicker]     = useState(false);
  const [songSearch, setSongSearch]     = useState('');
  const [songResults, setSongResults]   = useState([]);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [myPlaylists, setMyPlaylists]   = useState([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [uploadingLocal, setUploadingLocal] = useState(false);
  const [bursts, setBursts]             = useState([]);
  const [copied, setCopied]             = useState(false);
  const [sideTab, setSideTab]           = useState('participants');
  const [showReactions, setShowReactions] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // 'stop' | 'leave'
  const [mobileSideOpen, setMobileSideOpen] = useState(false);
  const [liveDuration, setLiveDuration] = useState(0);
  const [syncQuality, setSyncQuality]   = useState(100); // 0-100
  // V110000 — nouvelles features
  const [liveIsPaused, setLiveIsPaused] = useState(false);
  const [joinLeaveToast, setJoinLeaveToast] = useState(null); // { text, type }
  const [chatShared, setChatShared]     = useState(false);

  /* Refs */
  const chatRef        = useRef(null);
  const chanRef        = useRef(null);
  const burstId        = useRef(0);
  const hasJoined      = useRef(false);
  const syncTimer      = useRef(null);
  const heartbeatTimer = useRef(null);
  const durationTimer  = useRef(null);
  const typingTimer    = useRef(null);
  const isTyping       = useRef(false);
  const fileInputRef   = useRef(null);
  const isHostRef      = useRef(false);
  const roomRef        = useRef(null);
  const messagesRef    = useRef([]);
  const queueRef       = useRef([]);
  const startedAtRef   = useRef(null);
  const wakeLockRef    = useRef(null);
  const joinLeaveTimer = useRef(null); // V110000

  const isAdmin = currentUser?.email === 'eloadxfamily@gmail.com';
  const canStop = isHost || isAdmin;

  const scrollChat = useCallback(() => {
    setTimeout(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, 60);
  }, []);

  /* ── Screen Wake Lock (hôte mobile) ─────────────────────────── */
  const acquireWakeLock = useCallback(async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
    } catch {}
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
  }, []);

  /* ── Créer une salle ───────────────────────────────────────────── */
  const createRoom = useCallback(async () => {
    if (!currentUser || !roomName.trim() || creatingRoom) return;
    
    setCreatingRoom(true);
    setPhase('creating');
    
    try {
      // Utiliser la description personnalisée ou celle du genre
      const finalDescription = roomDescription?.trim() || 
        (roomGenre && GENRE_DESCRIPTIONS[roomGenre] ? GENRE_DESCRIPTIONS[roomGenre] : 
         'Rejoignez ce live pour découvrir de la musique incroyable !');

      // Créer la salle avec toutes les options
      const { data: roomData, error } = await supabase
        .from('live_rooms')
        .insert({
          title: roomName.trim(),
          description: finalDescription,
          genre: roomGenre || null,
          max_participants: maxParticipants,
          host_id: currentUser.id,
          is_active: true,
          is_private: isPrivate,
          participants_count: 1, // L'hôte compte comme participant
          created_at: new Date().toISOString()
        })
        .select()
        .single();
        
      if (error) throw error;
      
      // Ajouter l'hôte comme participant
      await supabase
        .from('live_room_participants')
        .insert({
          room_id: roomData.id,
          user_id: currentUser.id,
          joined_at: new Date().toISOString(),
          is_host: true
        });
      
      // Notifier les followers (si public)
      if (!isPrivate) {
        try {
          await notifyFollowers(supabase, currentUser.id, {
            type:     'live_start',
            title:    `🎙️ ${currentUser.username || 'Quelqu\'un'} est en live !`,
            body:     roomName.trim(),
            url:      `/live/${roomData.id}`,
            icon_url: currentUser.avatar_url || '/icon-192.png',
            from_user_id: currentUser.id,
            metadata: { roomId: roomData.id, roomName: roomName.trim() },
          });
          
          // 🏆 Vérifier les trophées pour l'hôte
          triggerAchievementCheck(currentUser.id, 'LIVE_STARTED');
        } catch (_) { /* non-fatal */ }
      }
      
      // Rediriger vers la salle
      navigate(`/live/${roomData.id}`);
      
    } catch (error) {
      console.error('Erreur création salle:', error);
      setPhase('lobby');
      alert('Erreur lors de la création : ' + (error.message || 'Veuillez réessayer.'));
    } finally {
      setCreatingRoom(false);
      // Réinitialiser le formulaire
      setRoomName('');
      setRoomDescription('');
      setRoomGenre('');
      setMaxParticipants(20);
      setIsPrivate(false);
    }
  }, [currentUser, roomName, roomDescription, roomGenre, maxParticipants, isPrivate, creatingRoom, navigate]);

  /* ── Fetch lobby ──────────────────────────────────────────────── */
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    try {
      const { data } = await supabase.from('live_rooms')
        .select('id,title,description,genre,is_active,is_private,host_id,participants_count,created_at,host:host_id(id,username,avatar_url),current_song:current_song_id(id,title,artist,cover_url)')
        .eq('is_active', true).eq('is_private', false)
        .order('participants_count', { ascending: false }).limit(20);
      setRooms(data || []);
    } catch (e) { console.error(e); }
    finally { setLoadingRooms(false); }
  }, []);

  useEffect(() => { if (roomIdParam) setPhase('joining'); else setPhase('lobby'); }, [roomIdParam]);
  useEffect(() => { if (phase === 'lobby') fetchRooms(); }, [phase, fetchRooms]);

  /* ── Queue helpers ──────────────────────────────────────────────── */
  const addToQueue = useCallback((song) => {
    if (!isHostRef.current || queueRef.current.find(s => s.id === song.id)) return;
    const upd = [...queueRef.current, song];
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: upd } }).catch(() => {});
  }, []);

  const removeFromQueue = useCallback((id) => {
    const upd = queueRef.current.filter(s => s.id !== id);
    queueRef.current = upd; setQueue(upd);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: upd } }).catch(() => {});
  }, []);

  /* ── Chrono du live ──────────────────────────────────────────────── */
  const startDurationTimer = useCallback(() => {
    if (durationTimer.current) clearInterval(durationTimer.current);
    startedAtRef.current = Date.now();
    durationTimer.current = setInterval(() => {
      setLiveDuration(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
  }, []);

  /* ── Sync / Heartbeat ──────────────────────────────────────────── */
  const startSync = useCallback(() => {
    if (syncTimer.current) clearInterval(syncTimer.current);
    syncTimer.current = setInterval(() => {
      if (!chanRef.current || !isHostRef.current) return;
      const audio = document.querySelector('audio');
      if (!audio) return;
      chanRef.current.send({
        type: 'broadcast', event: 'sync_position',
        payload: {
          currentTime: audio.currentTime,
          duration: audio.duration || 0,
          isPlaying: !audio.paused,
          timestamp: Date.now(),
        }
      }).catch(() => {});
    }, SYNC_MS);
  }, []);

  const stopSync = useCallback(() => {
    [syncTimer, heartbeatTimer, durationTimer].forEach(r => {
      if (r.current) { clearInterval(r.current); r.current = null; }
    });
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
    heartbeatTimer.current = setInterval(() => {
      if (chanRef.current && currentUser) {
        chanRef.current.track({
          user: {
            id: currentUser.id,
            username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
            avatar_url: currentUser.user_metadata?.avatar_url || null,
            lastSeen: Date.now(),
          }
        }).catch(() => {});
      }
    }, HEARTBEAT_MS);
  }, [currentUser]);

  /* ── Typing ─────────────────────────────────────────────────────── */
  const broadcastTyping = useCallback(() => {
    if (!chanRef.current || !currentUser) return;
    if (!isTyping.current) {
      isTyping.current = true;
      chanRef.current.send({ type: 'broadcast', event: 'typing',
        payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: true }
      }).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      chanRef.current?.send({ type: 'broadcast', event: 'typing',
        payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: false }
      }).catch(() => {});
    }, TYPING_TIMEOUT);
  }, [currentUser]);

  /* ── Message système ──────────────────────────────────────────── */
  const injectSys = useCallback((text, type = 'system') => {
    const sys = { id: `sys-${Date.now()}-${Math.random()}`, _system: true, _type: type, content: text, created_at: new Date().toISOString() };
    setMessages(prev => { const u = [...prev, sys]; messagesRef.current = u; return u; });
    scrollChat();
  }, [scrollChat]);

  /* ── V110000 : floating toast pour join/leave (discret, non-intrusif) ── */
  const showJoinLeave = useCallback((text, type) => {
    if (joinLeaveTimer.current) clearTimeout(joinLeaveTimer.current);
    setJoinLeaveToast({ text, type });
    joinLeaveTimer.current = setTimeout(() => setJoinLeaveToast(null), 3000);
  }, []);

  /* ── V110000 : Pause / Resume live par l'hôte ──────────────────── */
  const togglePause = useCallback(async () => {
    if (!isHostRef.current || !chanRef.current) return;
    const audio = document.querySelector('audio');
    const newPaused = !liveIsPaused;
    setLiveIsPaused(newPaused);
    if (audio) {
      try { newPaused ? audio.pause() : await audio.play(); } catch {}
    }
    chanRef.current.send({ type: 'broadcast', event: 'live_pause', payload: { isPaused: newPaused } }).catch(() => {});
    if (roomRef.current) {
      try { await supabase.from('live_rooms').update({ is_paused: newPaused }).eq('id', roomRef.current.id); } catch (_) {}
    }
  }, [liveIsPaused]);

  /* ── V110000 : Partager le lien du live dans le chat global ─────── */
  const shareInGlobalChat = useCallback(async () => {
    if (!currentUser || !roomRef.current) return;
    const username = currentUser.username || currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu\'un';
    const link     = `${window.location.origin}/#/live/${roomRef.current.id}`;
    const roomName = roomRef.current.name || roomRef.current.title || 'Live';
    const content  = `🔴 LIVE • ${roomName}\n${username} vous invite à rejoindre !\n👉 ${link}`;
    try {
      await supabase.from('chat_messages').insert({ user_id: currentUser.id, content: content.slice(0, 1000) });
      setChatShared(true);
      setTimeout(() => setChatShared(false), 3000);

      // Notifier TOUS les utilisateurs de l'invitation live
      notifyAll(supabase, {
        type:     'live_invite',
        title:    `🔴 ${username} est en live !`,
        body:     `"${roomName}" — clique pour rejoindre`,
        url:      `/live/${roomRef.current.id}`,
        icon_url: currentUser.avatar_url || currentUser.user_metadata?.avatar_url || '/icon-192.png',
        from_user_id: currentUser.id,
        metadata: {
          roomId:   roomRef.current.id,
          roomName,
          hostId:   currentUser.id,
          hostName: username,
        },
      }, [currentUser.id]).catch(() => {}); // exclure l'hôte lui-même

    } catch (err) { console.error('shareInGlobalChat:', err); }
  }, [currentUser]);

  /* ── Ancienne fonction createRoom supprimée (remplacée par la version complète) ── */

  /* ── Rejoindre une salle ─────────────────────────────────────── */
  const joinRoom = useCallback(async (id, asHost = false) => {
    if (!currentUser) { navigate('/login'); return; }
    if (hasJoined.current) return;
    hasJoined.current = true;
    setPhase('joining'); setJoinError(null); setChannelStatus('connecting');

    try {
      const { data: rd, error: re } = await supabase.from('live_rooms')
        .select('id,title,description,genre,is_active,is_private,host_id,participants_count,created_at,current_song_id,host:host_id(id,username,avatar_url),current_song:current_song_id(id,title,artist,cover_url,audio_url)')
        .eq('id', id).single();
      if (re || !rd) throw new Error('Salle introuvable ou expirée.');
      if (!rd.is_active) throw new Error('Cette salle est terminée.');

      setRoom(rd); roomRef.current = rd;
      const amHost = asHost || rd.host_id === currentUser.id;
      setIsHost(amHost); isHostRef.current = amHost;

      // Charger les messages sans join FK (FK non déclarée → 400)
      const { data: msgs } = await supabase.from('live_room_messages')
        .select('*')
        .eq('room_id', id).eq('is_deleted', false)
        .order('created_at', { ascending: true }).limit(100);
      if (msgs?.length) {
        // Enrichir avec les données users
        const uids = [...new Set(msgs.map(m => m.user_id).filter(Boolean))];
        const { data: uData } = await supabase.from('users').select('id,username,avatar_url').in('id', uids);
        const uMap = {}; (uData || []).forEach(u => { uMap[u.id] = u; });
        const enriched = msgs.map(m => ({ ...m, user: uMap[m.user_id] || null }));
        setMessages(enriched); messagesRef.current = enriched;
      } else { setMessages([]); messagesRef.current = []; }

      if (rd.current_song) {
        setNowPlaying(rd.current_song);
        playSong(rd.current_song, [rd.current_song]);
      }

      const chan = supabase.channel(`live_room:${id}`, {
        config: { presence: { key: currentUser.id }, broadcast: { self: false } }
      });

      chan
        .on('presence', { event: 'sync' }, () => {
          const users = Object.values(chan.presenceState()).flat().map(p => p.user).filter(Boolean);
          setParticipants(users);
          if (amHost) supabase.from('live_rooms').update({ participants_count: users.length }).eq('id', id).then(() => {});
        })
        .on('presence', { event: 'join' }, ({ newPresences }) => {
          const u = newPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) {
            showJoinLeave(`${u.username} a rejoint 👋`, 'join');
            // Notifier l'hôte qu'un participant a rejoint
            if (roomRef.current?.host_id && roomRef.current.host_id !== u.id) {
              notifyUser(supabase, roomRef.current.host_id, {
                type:     'live_join',
                title:    `👋 ${u.username} a rejoint ton live`,
                body:     roomRef.current.title || 'Live Room',
                url:      `/live/${roomRef.current.id}`,
                icon_url: u.avatar_url || '/icon-192.png',
                from_user_id: u.id,
                metadata: { roomId: roomRef.current.id, userId: u.id },
              }).catch(() => {});
            }
          }
        })
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          const u = leftPresences?.[0]?.user;
          if (u && u.id !== currentUser.id) showJoinLeave(`${u.username} a quitté`, 'leave');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          async ({ new: nm }) => {
            if (nm.is_deleted) return;
            const { data: u } = await supabase.from('users').select('id,username,avatar_url').eq('id', nm.user_id).single();
            const full = { ...nm, user: u || null };
            setMessages(prev => { if (prev.find(m => m.id === full.id)) return prev; const upd = [...prev, full]; messagesRef.current = upd; return upd; });
            scrollChat();
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_room_messages', filter: `room_id=eq.${id}` },
          ({ new: up }) => {
            if (up.is_deleted) {
              setMessages(prev => { const u = prev.filter(m => m.id !== up.id); messagesRef.current = u; return u; });
            } else {
              setMessages(prev => { const u = prev.map(m => m.id === up.id ? { ...m, content: up.content, is_edited: true } : m); messagesRef.current = u; return u; });
            }
          })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_rooms', filter: `id=eq.${id}` },
          ({ new: up }) => { if (!up.is_active) handleRoomClosed(); else setRoom(prev => ({ ...prev, ...up })); })
        .on('broadcast', { event: 'play_song' }, ({ payload }) => {
          if (payload?.song) {
            setNowPlaying(payload.song);
            playSong(payload.song, [payload.song]);
            setSyncProgress(0);
            injectSys(`🎵 ${payload.song.title} — ${payload.song.artist}`, 'song');
          }
        })
        .on('broadcast', { event: 'sync_position' }, ({ payload }) => {
          if (!payload) return;
          if (payload.duration > 0) setSyncProgress(payload.currentTime / payload.duration);
          if (isHostRef.current) return; // l'hôte ne se re-sync pas sur lui-même
          const audio = document.querySelector('audio');
          if (!audio) return;
          const lag = (Date.now() - payload.timestamp) / 1000;
          const target = payload.currentTime + lag;
          const drift = Math.abs(audio.currentTime - target);
          // Qualité de sync (100 = parfaite, 0 = très décalé)
          setSyncQuality(Math.max(0, Math.round(100 - drift * 10)));
          if (drift > SYNC_THRESHOLD) {
            audio.currentTime = target;
          }
          if (payload.isPlaying && audio.paused) audio.play().catch(() => {});
          if (!payload.isPlaying && !audio.paused) audio.pause();
        })
        .on('broadcast', { event: 'queue_update' }, ({ payload }) => {
          if (payload?.queue) { queueRef.current = payload.queue; setQueue(payload.queue); }
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (!payload || payload.userId === currentUser.id) return;
          setTypingUsers(prev => payload.typing
            ? prev.find(u => u.userId === payload.userId) ? prev : [...prev, { userId: payload.userId, username: payload.username }]
            : prev.filter(u => u.userId !== payload.userId));
        })
        .on('broadcast', { event: 'burst' }, ({ payload }) => addBurst(payload.emoji, payload.x))
        .on('broadcast', { event: 'room_closed' }, () => handleRoomClosed())
        // V110000 — Pause / Resume live reçu par les auditeurs
        .on('broadcast', { event: 'live_pause' }, ({ payload }) => {
          if (!payload || isHostRef.current) return;
          setLiveIsPaused(payload.isPaused);
          const audio = document.querySelector('audio');
          if (!audio) return;
          if (payload.isPaused) { audio.pause(); }
          else { audio.play().catch(() => {}); }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            setChannelStatus('connected');
            const uPayload = {
              user: {
                id: currentUser.id,
                username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Anonyme',
                avatar_url: currentUser.user_metadata?.avatar_url || null,
                lastSeen: Date.now(),
              }
            };
            try { await chan.track(uPayload); startHeartbeat(); } catch {}
            setPhase('room'); scrollChat();
            if (amHost) { startSync(); startDurationTimer(); acquireWakeLock(); }
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setChannelStatus('error'); setJoinError('Connexion perdue.'); hasJoined.current = false;
          }
        });

      chanRef.current = chan;
    } catch (err) {
      console.error('joinRoom:', err); setJoinError(err.message || 'Impossible de rejoindre.'); setPhase('error'); hasJoined.current = false;
    }
  }, [currentUser, navigate, playSong, scrollChat, startSync, startHeartbeat, startDurationTimer, acquireWakeLock, injectSys, showJoinLeave]); // eslint-disable-line

  useEffect(() => {
    if (roomIdParam && currentUser && phase === 'joining' && !hasJoined.current) joinRoom(roomIdParam);
  }, [roomIdParam, currentUser, phase, joinRoom]);

  const handleRoomClosed = useCallback(() => {
    stopSync(); releaseWakeLock();
    if (chanRef.current) { chanRef.current.untrack?.(); supabase.removeChannel(chanRef.current); chanRef.current = null; }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current = []; queueRef.current = []; setQueue([]);
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync, releaseWakeLock]);

  const leaveRoom = useCallback(async () => {
    stopSync(); releaseWakeLock();
    if (chanRef.current) {
      await chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) {
        await chanRef.current.send({ type: 'broadcast', event: 'room_closed', payload: {} });
        await supabase.from('live_rooms').update({ is_active: false, participants_count: 0 }).eq('id', roomRef.current.id);
      }
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
    setRoom(null); setParticipants([]); setMessages([]); messagesRef.current = []; queueRef.current = []; setQueue([]);
    setPhase('lobby'); hasJoined.current = false; navigate('/live');
  }, [navigate, stopSync, releaseWakeLock]);

  useEffect(() => () => {
    stopSync(); releaseWakeLock();
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (chanRef.current) {
      chanRef.current.untrack?.();
      if (isHostRef.current && roomRef.current) supabase.from('live_rooms').update({ is_active: false }).eq('id', roomRef.current.id).then(() => {});
      supabase.removeChannel(chanRef.current); chanRef.current = null;
    }
  }, []); // eslint-disable-line

  /* ── Envoyer un message ─────────────────────────────────────── */
  // ── @mention autocomplétion (Live) ─────────────────────────────
  const handleMsgChange = useCallback((e) => {
    const val = e.target.value.slice(0, 500);
    setMsgInput(val);
    broadcastTyping();
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const match  = before.match(/@([\w-]*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setShowMention(true);
      // @tous suggestion — afficher si la saisie commence par t, to, tou, tous, all, etc.
      const ALL_KEYWORDS = ['tous','all','everyone','todo','todos','tutti'];
      const showAll = q === '' || ALL_KEYWORDS.some(k => k.startsWith(q));
      setShowMentionAll(showAll);
      if (q.length >= 1) {
        clearTimeout(mentionDebounce.current);
        mentionDebounce.current = setTimeout(async () => {
          // Chercher parmi les participants du live d'abord, sinon tous les users
          const participantUsernames = participants.map(p => p.username).filter(Boolean);
          if (participantUsernames.length) {
            const filtered = participants.filter(p =>
              p.username?.toLowerCase().startsWith(q)
            ).slice(0, 5);
            setMentionUsers(filtered);
          } else {
            try {
              const { data } = await supabase.from('users')
                .select('id,username,avatar_url').ilike('username', q+'%').limit(5);
              setMentionUsers(data || []);
            } catch { setMentionUsers([]); }
          }
        }, 150);
      } else {
        // @ seul → montrer tous les participants
        setMentionUsers(participants.slice(0, 5));
        setShowMentionAll(true);
      }
    } else {
      setShowMention(false);
      setMentionUsers([]);
      setShowMentionAll(false);
    }
  }, [participants, broadcastTyping]);

  const insertMention = useCallback((username) => {
    const cursor    = msgInputRef.current?.selectionStart || msgInput.length;
    const before    = msgInput.slice(0, cursor);
    const after     = msgInput.slice(cursor);
    const newBefore = before.replace(/@([\w-]*)$/, '@' + username + ' ');
    const newText   = (newBefore + after).slice(0, 500);
    setMsgInput(newText);
    setShowMention(false);
    setMentionUsers([]);
    setShowMentionAll(false);
    setTimeout(() => {
      if (msgInputRef.current) {
        msgInputRef.current.focus();
        const pos = newBefore.length;
        msgInputRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  }, [msgInput]);

  const sendMessage = async () => {
    if (!msgInput.trim() || !chanRef.current || !currentUser || !roomRef.current) return;
    const content = msgInput.trim().slice(0, 500);
    setMsgInput(''); isTyping.current = false;
    if (typingTimer.current) { clearTimeout(typingTimer.current); typingTimer.current = null; }
    chanRef.current.send({ type: 'broadcast', event: 'typing',
      payload: { userId: currentUser.id, username: currentUser.user_metadata?.username || 'Anonyme', typing: false }
    }).catch(() => {});
    try {
      await supabase.from('live_room_messages').insert({ room_id: roomRef.current.id, user_id: currentUser.id, content });
      scrollChat();

      const uname    = currentUser.username || currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Quelqu\'un';
      const roomId   = roomRef.current.id;
      const roomName = roomRef.current.name || roomRef.current.title || 'Live';
      const liveUrl  = `/live/${roomId}`;
      const icon     = currentUser.avatar_url || currentUser.user_metadata?.avatar_url || '/icon-192.png';
      const meta     = { roomId, senderName: uname, senderId: currentUser.id };

      // 1. Notifier l'hôte du live (si c'est pas lui qui envoie)
      if (roomRef.current?.host_id && roomRef.current.host_id !== currentUser.id) {
        notifyUser(supabase, roomRef.current.host_id, {
          type:     'live_comment',
          title:    `💬 ${uname} dans ton live`,
          body:     content.slice(0, 100),
          url:      liveUrl,
          icon_url: icon,
          from_user_id: currentUser.id,
          metadata: meta,
        }).catch(() => {});
      }

      // 2. @mentions individuelles → notif de type 'mention' pour chaque personne taguée
      const hasMentions = /@[\w-]+/.test(content);
      if (hasMentions) {
        notifyMentions(supabase, content, currentUser.id, {
          title:    `🏷 ${uname} t'a mentionné dans un live`,
          body:     `Dans "${roomName}" : ${content.slice(0, 80)}`,
          url:      liveUrl,
          icon_url: icon,
          from_user_id: currentUser.id,
          metadata: { ...meta, context: 'live' },
        }).catch(() => {});
      }
    } catch (err) { console.error(err); }
  };

  const saveEdit = async () => {
    if (!editContent.trim() || !editingMsgId) return;
    await supabase.from('live_room_messages')
      .update({ content: editContent.trim().slice(0, 500), is_edited: true })
      .eq('id', editingMsgId).eq('user_id', currentUser.id);
    setEditingMsgId(null); setEditContent('');
  };

  const deleteMessage = async (msgId) => {
    await supabase.from('live_room_messages').update({ is_deleted: true }).eq('id', msgId).eq('user_id', currentUser.id);
  };

  /* ── Diffuser un son ─────────────────────────────────────────── */
  const broadcastSong = useCallback(async (song) => {
    if (!isHostRef.current || !chanRef.current || !roomRef.current) return;
    setNowPlaying(song); playSong(song, [song]); setSyncProgress(0);
    setShowPicker(false); setSongSearch(''); setSongResults([]);
    if (!song._isLocal) await supabase.from('live_rooms').update({ current_song_id: song.id }).eq('id', roomRef.current.id);
    await chanRef.current.send({ type: 'broadcast', event: 'play_song', payload: { song } });
    injectSys(`🎵 ${song.title} — ${song.artist}`, 'song');
  }, [playSong, injectSys]);

  const skipToNext = useCallback(() => {
    if (!isHostRef.current || queueRef.current.length === 0) return;
    const [next, ...rest] = queueRef.current; queueRef.current = rest; setQueue(rest);
    chanRef.current?.send({ type: 'broadcast', event: 'queue_update', payload: { queue: rest } }).catch(() => {});
    broadcastSong(next);
  }, [broadcastSong]);

  /* ── Auto-avance quand le son se termine ───────────────────────── */
  useEffect(() => {
    if (!isHost) return;
    const audio = document.querySelector('audio');
    if (!audio) return;
    const onEnded = () => {
      if (queueRef.current.length > 0) skipToNext();
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [isHost, skipToNext]);

  /* ── Fichier local ──────────────────────────────────────────────── */
  const handleLocalFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !isHostRef.current || !roomRef.current) return;
    if (!file.type.startsWith('audio/')) { alert('Fichiers audio uniquement (mp3, wav…)'); return; }
    if (file.size > 80 * 1024 * 1024) { alert('Fichier trop volumineux (max 80 Mo)'); return; }
    setUploadingLocal(true);
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const path = `live-temp/${roomRef.current.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('live-room-audio').upload(path, file, { contentType: file.type, upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('live-room-audio').getPublicUrl(path);
      const title = file.name.replace(/\.[^.]+$/, '');
      await broadcastSong({
        id: `local-${Date.now()}`, title, artist: currentUser.user_metadata?.username || 'Hôte',
        audio_url: urlData.publicUrl, cover_url: null, plays_count: 0, _isLocal: true,
      });
    } catch (err) { alert('Erreur upload : ' + (err.message || err)); }
    finally { setUploadingLocal(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  /* ── Charger mes playlists ────────────────────────────────────── */
  const loadMyPlaylists = async () => {
    if (!currentUser) return;
    setLoadingPlaylists(true);
    try {
      const { data } = await supabase.from('playlists')
        .select('id, name, cover_url, playlist_songs(songs(id,title,artist,cover_url,audio_url))')
        .eq('owner_id', currentUser.id).order('updated_at', { ascending: false }).limit(10);
      setMyPlaylists(data || []);
    } catch {}
    finally { setLoadingPlaylists(false); }
  };

  const addPlaylistToQueue = (playlist) => {
    const songs = (playlist.playlist_songs || []).map(ps => ps.songs).filter(Boolean);
    songs.forEach(s => addToQueue(s));
    injectSys(`📋 ${songs.length} son(s) de "${playlist.name}" ajoutés à la file`, 'system');
    setShowPlaylists(false);
  };

  /* ── Bursts emoji ───────────────────────────────────────────────── */
  const addBurst = (emoji, x) => {
    const e = emoji || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
    const posX = x ?? `${Math.random() * 80 + 10}%`;
    const id = ++burstId.current;
    setBursts(prev => [...prev, { id, emoji: e, x: posX }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 2000);
  };

  const sendBurst = async (emoji) => {
    if (!chanRef.current) return;
    const e = emoji || REACTION_EMOJIS[Math.floor(Math.random() * REACTION_EMOJIS.length)];
    const x = `${Math.random() * 80 + 10}%`;
    addBurst(e, x);
    // V110000 : ne pas fermer automatiquement — l'utilisateur ferme manuellement
    await chanRef.current.send({ type: 'broadcast', event: 'burst', payload: { emoji: e, x } });
  };

  /* ── Recherche ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (!songSearch.trim()) { setSongResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('songs').select('id,title,artist,cover_url,audio_url')
        .or(`title.ilike.%${songSearch}%,artist.ilike.%${songSearch}%`).eq('is_archived', false).limit(10);
      setSongResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [songSearch]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/#/live/${roomRef.current?.id}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500); });
  };

  /* Computed */
  const otherTyping = typingUsers.filter(u => u.userId !== currentUser?.id);
  const typingLabel = otherTyping.length === 1 ? `${otherTyping[0].username} écrit…`
    : otherTyping.length > 1 ? `${otherTyping.length} personnes écrivent…` : null;
  const pctCap = participants.length / MAX_PARTICIPANTS;

  /* ════════════════════════════════════════════════════════════════
     PHASES
     ════════════════════════════════════════════════════════════════ */
  if (phase === 'init' || phase === 'joining')
    return <LoadingScreen label={roomIdParam ? 'Connexion à la salle…' : 'Chargement…'} />;

  if (phase === 'error') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center"><WifiOff className="w-8 h-8 text-red-400" /></div>
      <div className="text-center"><p className="text-white font-bold text-xl mb-2">{'Impossible de rejoindre'}</p><p className="text-gray-400 text-sm max-w-sm">{joinError}</p></div>
      <div className="flex gap-3">
        <button onClick={() => { setPhase('lobby'); hasJoined.current = false; navigate('/live'); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm">
          <ArrowLeft className="w-4 h-4" />{'Retour'}
        </button>
        {roomIdParam && <button onClick={() => { hasJoined.current = false; setPhase('joining'); joinRoom(roomIdParam); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-sm">
          <RefreshCw className="w-4 h-4" />Réessayer
        </button>}
      </div>
    </div>
  );

  /* ── LOBBY ─────────────────────────────────────────────────────── */
  if (phase === 'lobby' || phase === 'creating') return (
    <>
      <Helmet><title>Live Rooms — NovaSound TITAN LUX</title></Helmet>
      <style>{BRAND_STYLES}</style>
      <div className="min-h-screen flex flex-col" style={{background:'#03030d'}}>
        <Header />

        {/* ── Background premium ── */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" style={{top:64}}>
          <div className="absolute inset-0" style={{background:'linear-gradient(135deg,#03030d 0%,#06061a 40%,#080820 70%,#03030d 100%)'}}/>
          <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full opacity-20" style={{background:'radial-gradient(circle,rgba(34,197,94,.4) 0%,transparent 70%)',filter:'blur(60px)'}}/>
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-15" style={{background:'radial-gradient(circle,rgba(6,182,212,.4) 0%,transparent 70%)',filter:'blur(60px)'}}/>
          <div className="absolute top-1/3 right-0 w-[300px] h-[300px] rounded-full opacity-10" style={{background:'radial-gradient(circle,rgba(168,85,247,.5) 0%,transparent 70%)',filter:'blur(50px)'}}/>
          <div className="absolute inset-0 opacity-[0.015]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,.15) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.15) 1px,transparent 1px)',backgroundSize:'50px 50px'}}/>
        </div>

        <main className="relative z-10 flex-1 w-full max-w-screen-xl mx-auto px-4 md:px-8 lg:px-12 py-6 sm:py-10 pb-28">

          {/* ── HERO ── */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 sm:mb-14">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-5 text-xs sm:text-sm font-bold"
              style={{background:'rgba(34,197,94,.08)',border:'1px solid rgba(34,197,94,.22)',color:'#4ade80'}}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
              </span>
              LIVE ROOMS
              {rooms.length > 0 && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-black" style={{background:'rgba(34,197,94,.15)'}}>{rooms.length} actives</span>}
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white mb-3 sm:mb-5 tracking-tight leading-none">
              Écoute{' '}
              <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent"
                style={{backgroundSize:'200% 200%',animation:'nsGradientShift 5s ease infinite'}}>
                ensemble
              </span>
            </h1>
            <p className="text-gray-500 text-sm sm:text-lg max-w-xl mx-auto leading-relaxed">
              Crée une salle, invite tes amis et partagez la même vibe musicale en temps réel.
            </p>
          </motion.div>

          {/* ── CREATE ROOM — glass card ── */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-3xl p-5 sm:p-8 mb-8 sm:mb-12"
            style={{background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',backdropFilter:'blur(24px)',boxShadow:'0 8px 64px rgba(0,0,0,.4)'}}>

            <div className="flex items-center gap-3 sm:gap-4 mb-5 sm:mb-7">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg,#16a34a,#0891b2)',boxShadow:'0 0 24px rgba(22,163,74,.3)'}}>
                <Radio className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
              </div>
              <div>
                <h2 className="text-white font-black text-lg sm:text-2xl tracking-tight">Créer ta salle live</h2>
                <p className="text-gray-500 text-xs sm:text-sm mt-0.5">Lance un live et partage ta musique</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Titre */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Titre du live</label>
                <input
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createRoom()}
                  placeholder="Ex: Soirée Chill, Session Hip-Hop, Mix Electro..."
                  maxLength={60}
                  className="w-full text-white text-base focus:outline-none transition-all rounded-2xl px-4 py-3.5"
                  style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.09)',transition:'border-color .2s,box-shadow .2s'}}
                  onFocus={e=>{e.target.style.borderColor='rgba(6,182,212,.4)';e.target.style.boxShadow='0 0 0 3px rgba(6,182,212,.08)';}}
                  onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,.09)';e.target.style.boxShadow='none';}}
                />
                <p className="text-[10px] text-gray-700 mt-1 text-right">{roomName.length}/60</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description <span className="text-gray-700 font-normal normal-case">(optionnel)</span></label>
                <textarea
                  value={roomDescription || ''}
                  onChange={e => setRoomDescription(e.target.value)}
                  placeholder="Décris l'ambiance, le style musical..."
                  maxLength={200}
                  rows={2}
                  className="w-full text-white text-sm focus:outline-none transition-all rounded-2xl px-4 py-3 resize-none"
                  style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.09)'}}
                  onFocus={e=>{e.target.style.borderColor='rgba(6,182,212,.35)';}}
                  onBlur={e=>{e.target.style.borderColor='rgba(255,255,255,.09)';}}
                />
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-2.5">
                <button
                  onClick={() => setIsPrivate(!isPrivate)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={isPrivate
                    ? {background:'rgba(245,158,11,.12)',border:'1px solid rgba(245,158,11,.35)',color:'#fbbf24'}
                    : {background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.5)'}}>
                  {isPrivate ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  {isPrivate ? 'Privée' : 'Publique'}
                </button>
                <button
                  onClick={() => setMaxParticipants(maxParticipants === 10 ? 50 : maxParticipants - 10)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.5)'}}>
                  <Users className="w-4 h-4" />Max: {maxParticipants}
                </button>
              </div>

              {/* Genres */}
              <div className="flex flex-wrap gap-2">
                {ALL_GENRES.map(g => (
                  <button key={g} type="button"
                    onClick={() => setRoomGenre(roomGenre === g ? '' : g)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                    style={roomGenre === g
                      ? {background:'rgba(6,182,212,.18)',border:'1px solid rgba(6,182,212,.45)',color:'#22d3ee',boxShadow:'0 0 12px rgba(6,182,212,.15)'}
                      : {background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',color:'rgba(255,255,255,.4)'}}>
                    {g}
                  </button>
                ))}
              </div>

              {roomGenre && GENRE_DESCRIPTIONS[roomGenre] && (
                <div className="p-3 rounded-xl text-xs text-cyan-300/70 leading-relaxed"
                  style={{background:'rgba(6,182,212,.05)',border:'1px solid rgba(6,182,212,.12)'}}>
                  💡 {GENRE_DESCRIPTIONS[roomGenre]}
                </div>
              )}

              {/* CTA */}
              <button
                onClick={createRoom}
                disabled={!roomName.trim() || creatingRoom || !currentUser}
                className="w-full text-white font-black py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg,#16a34a,#0891b2,#7c3aed)',
                  backgroundSize: '200% 200%',
                  animation: 'nsGradientShift 4s ease infinite',
                  boxShadow: '0 8px 32px rgba(22,163,74,.3),0 4px 16px rgba(0,0,0,.3)',
                }}>
                {creatingRoom ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /><span>Création en cours…</span></>
                ) : (
                  <><Zap className="w-5 h-5" /><span>Lancer le live maintenant</span></>
                )}
              </button>

              {!currentUser && (
                <p className="text-amber-400/80 text-sm text-center flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  <Link to="/login" className="underline hover:text-amber-300 font-medium">Connecte-toi pour créer une salle</Link>
                </p>
              )}
            </div>
          </motion.div>

          {/* ── ROOMS GRID ── */}
          <div>
            <div className="flex items-center justify-between mb-5 sm:mb-6">
              <div className="flex items-center gap-3">
                <h2 className="text-white font-black text-lg sm:text-xl flex items-center gap-2.5">
                  <Radio className="w-5 h-5 text-green-400" />Salles actives
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold text-green-400"
                  style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.2)'}}>
                  {rooms.length}
                </span>
              </div>
              <button onClick={fetchRooms}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.07)',color:'rgba(255,255,255,.4)'}}>
                <RefreshCw className="w-3.5 h-3.5" />Actualiser
              </button>
            </div>

            {loadingRooms ? (
              <div className="flex justify-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:'rgba(34,197,94,.1)',border:'1px solid rgba(34,197,94,.2)'}}>
                    <Loader2 className="w-6 h-6 text-green-400 animate-spin" />
                  </div>
                  <p className="text-gray-600 text-sm">Chargement des salles…</p>
                </div>
              </div>
            ) : rooms.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-20 sm:py-28 rounded-3xl"
                style={{background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.05)',backdropFilter:'blur(12px)'}}>
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                  style={{background:'rgba(34,197,94,.07)',border:'1px solid rgba(34,197,94,.12)'}}>
                  <Radio className="w-10 h-10" style={{color:'rgba(34,197,94,.4)'}} />
                </div>
                <p className="text-white font-bold text-xl mb-2">Aucune salle active</p>
                <p className="text-gray-600 text-sm mb-6">Sois le premier à lancer une session live !</p>
                <button onClick={() => document.querySelector('input')?.focus()}
                  className="px-6 py-3 rounded-2xl text-white font-bold text-sm"
                  style={{background:'linear-gradient(135deg,#16a34a,#0891b2)'}}>
                  Créer la première salle
                </button>
              </motion.div>
            ) : (
              <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map((r, i) => (
                  <motion.div key={r.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <RoomCard room={r} onJoin={joinRoom} />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </>
  );

  /* ══════════════════════════════════════════════════════════════════
     ROOM — Interface principale
     ══════════════════════════════════════════════════════════════════ */
  return (
    <>
      <Helmet><title>{room?.name || 'Live Room'} — NovaSound TITAN LUX</title></Helmet>
      <style>{BRAND_STYLES}</style>
      <div className="min-h-screen flex flex-col" style={{background:'#03030d'}}>
        <Header />
        {/* ── Bande de marque mobile ── */}
        <div className="lg:hidden">
          <BrandHeader variant="mobile" />
        </div>

        <main className="flex-1 flex flex-col overflow-hidden"
          style={{
            /* Sur mobile on réserve la place pour le BottomNav (56px) */
            height: 'calc(100dvh - 120px)',
            maxHeight: 'calc(100dvh - 120px)',
            paddingBottom: 'var(--bottom-nav-h, 0px)',
          }}>
          <style>{`:root { --bottom-nav-h: 56px; } @media (min-width: 768px) { :root { --bottom-nav-h: 0px; } }`}</style>

          {/* ── Barre supérieure ──────────────────────────────────── */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 sm:px-4 py-2.5 room-glass-bar">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button onClick={() => setConfirmModal('leave')} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <Avatar user={room?.host} size={8} crown />
              <div className="min-w-0">
                <h1 className="text-white font-bold text-sm sm:text-base truncate">{room?.name}</h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500 hidden sm:block">par <NoTranslate tag="span">{room?.host?.username}</NoTranslate></p>
                  <ConnBadge status={channelStatus} />
                  {liveDuration > 0 && (
                    <span className="text-[10px] text-green-400 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{fmtDuration(liveDuration)}
                    </span>
                  )}
                  {/* Indicateur pause */}
                  {liveIsPaused && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-[10px] text-amber-300 flex items-center gap-1 px-2 py-0.5 rounded-full font-bold"
                      style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', boxShadow: '0 0 10px rgba(245,158,11,0.15)' }}
                    >
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      >
                        <Pause className="w-2.5 h-2.5" />
                      </motion.span>
                      En pause
                    </motion.span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Compteur participants */}
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5" />
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pctCap >= 1 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-cyan-500'}`} style={{ width: `${pctCap * 100}%` }} />
                </div>
                <span>{participants.length}/{MAX_PARTICIPANTS}</span>
              </div>
              {/* Qualité de sync (invités) */}
              {!isHost && (
                <span className="hidden sm:flex items-center gap-1 text-xs text-gray-600">
                  <Volume2 className="w-3 h-3" />
                  <span className={syncQuality > 70 ? 'text-green-400' : syncQuality > 40 ? 'text-amber-400' : 'text-red-400'}>{syncQuality}%</span>
                </span>
              )}
              {/* V110000 — Bouton Pause/Resume hôte */}
              {isHost && (
                <button onClick={togglePause}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-all ${liveIsPaused ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                  {liveIsPaused ? <><Play className="w-3.5 h-3.5" /><span className="hidden sm:inline">{'Reprendre'}</span></> : <><Pause className="w-3.5 h-3.5" /><span className="hidden sm:inline">{'Pause'}</span></>}
                </button>
              )}
              <button onClick={copyLink} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all">
                {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Copié</> : <><Share2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Partager</span></>}
              </button>
              {/* Live Like Button */}
              <LiveLikeButton 
                roomId={room?.id}
                initialLikes={room?.likes_count || 0}
                roomTitle={room?.name}
                hostId={room?.host_id}
                compact={true}
              />
              {/* Bouton panneau mobile */}
              <button onClick={() => setMobileSideOpen(!mobileSideOpen)}
                className="lg:hidden flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800 px-2.5 py-1.5 rounded-lg transition-colors">
                <Users className="w-3.5 h-3.5" />
                {participants.length > 0 && <span className="text-xs font-bold text-cyan-400">{participants.length}</span>}
              </button>
            </div>
          </div>

          {/* ── Corps principal ───────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden">

            {/* Chat (zone principale) */}
            <div className="flex-1 flex flex-col min-w-0">

              {/* Now Playing bar */}
              {nowPlaying && (
                <div className="flex-shrink-0 nowplaying-glass px-3 sm:px-4 py-2.5 flex items-center gap-3">
                  {nowPlaying.cover_url
                    ? <img src={nowPlaying.cover_url} alt={nowPlaying.title} className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Eq active />
                      <NoTranslate tag="p" className="text-white text-xs sm:text-sm font-semibold truncate">{nowPlaying.title}</NoTranslate>
                    </div>
                    <NoTranslate tag="p" className="text-gray-500 text-[11px] sm:text-xs truncate truncate">{nowPlaying.artist}</NoTranslate>
                    <div className="mt-1.5 h-1 bg-gray-800 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-gradient-to-r from-green-500 to-cyan-500 rounded-full"
                        style={{ width: `${syncProgress * 100}%` }} transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                  {isHost && queue.length > 0 && (
                    <button onClick={skipToNext} className="flex-shrink-0 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
                      <SkipForward className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Messages — peut rétrécir pour laisser de la place à l'input */}
              <div className="min-h-0 flex-1 relative overflow-hidden" style={{ minHeight: '60px' }}>

                {/* ── OVERLAY PAUSE — Pro cinematic effect ── */}
                <AnimatePresence>
                  {liveIsPaused && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none"
                      style={{
                        background: 'linear-gradient(180deg, rgba(3,3,18,0.82) 0%, rgba(8,5,28,0.9) 50%, rgba(3,3,18,0.82) 100%)',
                        backdropFilter: 'blur(6px)',
                      }}
                    >
                      {/* Scan line animée */}
                      <motion.div
                        animate={{ y: ['-100%', '200%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                        className="absolute inset-x-0 h-px pointer-events-none"
                        style={{ background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.4), rgba(168,85,247,0.4), transparent)' }}
                      />

                      {/* Icône pause animée */}
                      <motion.div
                        animate={{ scale: [1, 1.06, 1], opacity: [0.9, 1, 0.9] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        className="relative mb-4"
                      >
                        {/* Halo pulsant */}
                        <motion.div
                          animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
                          className="absolute inset-0 rounded-full"
                          style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.5) 0%, transparent 70%)' }}
                        />
                        <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.1))',
                            border: '1.5px solid rgba(245,158,11,0.5)',
                            boxShadow: '0 0 30px rgba(245,158,11,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
                          }}>
                          <Pause className="w-7 h-7 text-amber-400" />
                        </div>
                      </motion.div>

                      {/* Texte */}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="text-center"
                      >
                        <p className="text-white font-black text-base tracking-wide mb-1">Live en pause</p>
                        <p className="text-amber-400/70 text-xs font-medium">
                          {isHost ? "Reprends quand tu es prêt 👑" : "L'hôte a mis le live en pause…"}
                        </p>
                      </motion.div>

                      {/* Bouton Reprendre pour l'hôte */}
                      {isHost && (
                        <motion.button
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.25 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={togglePause}
                          className="pointer-events-auto mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white"
                          style={{
                            background: 'linear-gradient(135deg, #d97706, #b45309)',
                            boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
                          }}
                        >
                          <Play className="w-4 h-4 fill-current" />
                          Reprendre le live
                        </motion.button>
                      )}

                      {/* Points de suspension animés (auditeurs) */}
                      {!isHost && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                          className="flex gap-1.5 mt-4"
                        >
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.9, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.22 }}
                              className="w-1.5 h-1.5 rounded-full bg-amber-400"
                            />
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* V110000 — Toast discret join/leave en haut du chat */}
                <AnimatePresence>
                  {joinLeaveToast && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.25 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
                    >
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border backdrop-blur-sm
                        ${joinLeaveToast.type === 'join'
                          ? 'bg-green-500/15 border-green-500/30 text-green-300'
                          : 'bg-gray-800/90 border-gray-700 text-gray-400'}`}>
                        {joinLeaveToast.type === 'join' ? <Users className="w-3 h-3" /> : <LogOut className="w-3 h-3" />}
                        {joinLeaveToast.text}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={chatRef} className="absolute inset-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-2 scrollbar-hide">
                  <EmojiBurst bursts={bursts} />
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="w-14 h-14 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4"><Headphones className="w-7 h-7 text-gray-700" /></div>
                      <p className="text-gray-500 text-sm font-medium">{'Aucun message'}</p>
                      <p className="text-gray-700 text-xs mt-1">{'Commence la conversation !'}</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {messages.map(m => m._system ? (
                        <SysMsg key={m.id} text={m.content}
                          icon={m._type === 'song' ? Music : m._type === 'join' ? Users : m._type === 'leave' ? LogOut : Zap} />
                      ) : (
                        <ChatMsg key={m.id} m={m}
                          isMine={m.user_id === currentUser?.id}
                          currentUserId={currentUser?.id}
                          currentUsername={currentUser?.username || currentUser?.user_metadata?.username}
                          participants={participants}
                          isEditing={editingMsgId === m.id} editContent={editContent}
                          onStartEdit={() => { setEditingMsgId(m.id); setEditContent(m.content); }}
                          onSaveEdit={saveEdit} onCancelEdit={() => { setEditingMsgId(null); setEditContent(''); }}
                          onDelete={() => deleteMessage(m.id)} onChangeEdit={setEditContent} />
                      ))}
                    </AnimatePresence>
                  )}
                  {typingLabel && (
                    <div className="flex items-center gap-2 px-1"><TypingDots /><span className="text-xs text-gray-600 italic">{typingLabel}</span></div>
                  )}
                </div>
              </div>

              {/* Input chat — zone expansive qui comble l'espace disponible */}
              <div
                className="flex-shrink-0 flex flex-col px-3 pt-2 chat-glass-input border-t border-white/[0.05]"
                style={{
                  paddingBottom: `calc(env(safe-area-inset-bottom, 10px) + 10px${playerVisible && playerSong ? ' + 72px' : ''})`,
                  /* Comble l'espace restant : au moins 28vh pour être généreux, plafonné à 45vh */
                  minHeight: 'clamp(120px, 28vh, 380px)',
                }}
              >
                <AnimatePresence>
                  {showReactions && (
                    <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="flex flex-wrap gap-2 mb-2.5 p-3 bg-gray-800 rounded-xl relative">
                      <button
                        onClick={() => setShowReactions(false)}
                        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-gray-400 hover:text-white transition-colors"
                        title="Fermer">
                        <X className="w-3 h-3" />
                      </button>
                      <div className="w-full flex flex-wrap gap-2 pr-6">
                        {REACTION_EMOJIS.map(e => (
                          <button key={e} onClick={() => sendBurst(e)} className="text-xl hover:scale-125 transition-transform active:scale-90">{e}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="flex gap-2 items-end flex-1 min-h-0">
                  <div className="relative flex-1 h-full flex flex-col">
                    {showMention && (mentionUsers.length > 0 || showMentionAll) && (
                      <div className="absolute bottom-full mb-2 left-0 right-0 lr-mention-popup z-50">
                        {/* Header */}
                        <div className="flex items-center gap-2 px-3 py-2" style={{borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(255,255,255,.02)'}}>
                          <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">@ Mentions</span>
                          <span className="ml-auto text-[10px] text-gray-700">↵ sélectionner</span>
                        </div>
                        <div className="p-1.5 space-y-0.5 max-h-52 overflow-y-auto" style={{scrollbarWidth:'none'}}>
                          {/* @tous */}
                          {showMentionAll && (
                            <button
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left hover:bg-amber-500/8"
                              onMouseDown={e => { e.preventDefault(); insertMention('tous'); }}>
                              <div className="w-9 h-9 rounded-2xl flex items-center justify-center text-lg flex-shrink-0"
                                style={{background:'rgba(234,179,8,.15)',border:'1px solid rgba(234,179,8,.3)'}}>
                                📢
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-yellow-300 text-sm font-black">@tous</div>
                                <div className="text-gray-600 text-[11px]">Mentionner tous les participants</div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black text-yellow-400"
                                style={{background:'rgba(234,179,8,.12)',border:'1px solid rgba(234,179,8,.2)'}}>TOUS</span>
                            </button>
                          )}
                          {/* Séparateur */}
                          {showMentionAll && mentionUsers.length > 0 && (
                            <div style={{height:1,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)',margin:'4px 8px'}}/>
                          )}
                          {/* Participants */}
                          {mentionUsers.map((u, ui) => (
                            <button key={u.id}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left hover:bg-cyan-500/8"
                              onMouseDown={e => { e.preventDefault(); insertMention(u.username); }}>
                              <div className="relative flex-shrink-0">
                                {u.avatar_url
                                  ? <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-2xl object-cover" style={{border:'1px solid rgba(6,182,212,.3)'}}/>
                                  : <div className="w-9 h-9 rounded-2xl flex items-center justify-center font-black text-sm text-white"
                                      style={{background:'linear-gradient(135deg,rgba(6,182,212,.25),rgba(168,85,247,.2))',border:'1px solid rgba(6,182,212,.25)'}}>
                                      {(u.username||'?')[0].toUpperCase()}
                                    </div>
                                }
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2" style={{borderColor:'#04041a'}}/>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-white text-sm font-black"><NoTranslate>@{u.username}</NoTranslate></div>
                                <div className="text-gray-600 text-[10px]">Participant du live</div>
                              </div>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-cyan-400/70"
                                style={{background:'rgba(6,182,212,.06)',border:'1px solid rgba(6,182,212,.12)'}}>@TAG</span>
                            </button>
                          ))}
                          {mentionUsers.length === 0 && !showMentionAll && (
                            <div className="flex flex-col items-center py-4 text-center">
                              <p className="text-gray-700 text-xs">Aucun participant trouvé</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    <textarea
                      ref={msgInputRef}
                      value={msgInput}
                      onChange={handleMsgChange}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Écrire un message… (@nom pour mentionner)"
                      maxLength={500}
                      style={{ resize: 'none', flex: 1, minHeight: 80 }}
                      className="w-full bg-gray-800/80 border border-gray-700/60 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-cyan-500 placeholder-gray-600 transition-colors leading-relaxed"
                    />
                    {/* Compteur de caractères en bas à droite de la zone */}
                    {msgInput.length > 400 && (
                      <span className="absolute bottom-2 right-3 text-[10px] text-amber-400 pointer-events-none">
                        {500 - msgInput.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0 pb-0.5">
                    <button onClick={() => setShowReactions(!showReactions)}
                      className={`p-2.5 rounded-xl transition-all ${showReactions ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                      <Smile className="w-4 h-4" />
                    </button>
                    <button onClick={sendMessage} disabled={!msgInput.trim()}
                      className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-600 hover:to-fuchsia-600 disabled:opacity-40 text-white p-2.5 rounded-xl transition-all flex-shrink-0 shadow-lg shadow-cyan-500/20">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SIDEBAR desktop ───────────────────────────────────── */}
            <div className="hidden lg:flex w-72 xl:w-80 flex-col side-panel-glass overflow-y-auto">
              {/* Brand desktop */}
              <BrandHeader variant="desktop" />
              {/* Tabs */}
              <div className="lr-side-tabs flex-shrink-0">
                {[
                  ['participants','👥','Participants','active-participants'],
                  ['queue','🎵','File','active-queue'],
                  ['controls','⚙️','Contrôles','active-controls'],
                ].map(([id,emoji,label,activeClass]) => (
                  <button key={id} onClick={() => setSideTab(id)}
                    className={`lr-side-tab ${sideTab===id ? activeClass : ''}`}>
                    <span className="text-base leading-none">{emoji}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {sideTab === 'participants' && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><Users className="w-4 h-4 text-green-400" />{'Participants'}</h3>
                      <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{participants.length}/{MAX_PARTICIPANTS}</span>
                    </div>
                    {participants.length === 0
                      ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{background:'rgba(34,197,94,0.06)',border:'1px solid rgba(34,197,94,0.12)'}}>
                            <Users className="w-5 h-5 text-green-500/40"/>
                          </div>
                          <p className="text-gray-600 text-xs">En attente de participants…</p>
                        </div>
                      )
                      : participants.map(p => (
                        <motion.div key={p.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}}
                          className={`lr-participant mb-1.5 ${p.id===room?.host_id?'is-host':''}`}>
                          <Avatar user={p} size={7} pulse />
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs font-semibold truncate"><NoTranslate>{p.username}</NoTranslate></p>
                            {p.id === room?.host_id
                              ? <p className="text-amber-400 text-[10px] flex items-center gap-1"><Crown className="w-2.5 h-2.5"/>Hôte</p>
                              : <p className="text-gray-600 text-[10px]">Auditeur</p>}
                          </div>
                          {p.id === room?.host_id && (
                            <motion.div animate={{rotate:[0,5,-5,0]}} transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}>
                              <Crown className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                            </motion.div>
                          )}
                        </motion.div>
                      ))
                    }
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pctCap >= 1 ? 'bg-red-500' : 'bg-gradient-to-r from-green-500 to-cyan-500'}`} style={{ width: `${pctCap * 100}%` }} />
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">{MAX_PARTICIPANTS - participants.length} place{MAX_PARTICIPANTS - participants.length !== 1 ? 's' : ''} libre{MAX_PARTICIPANTS - participants.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                )}

                {sideTab === 'queue' && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white font-bold text-sm flex items-center gap-2"><ListMusic className="w-4 h-4 text-cyan-400" />{'File musicale'}</h3>
                      {queue.length > 0 && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">{queue.length}</span>}
                    </div>
                    {queue.length === 0
                      ? <div className="flex flex-col items-center justify-center py-8 text-center">
                          <ListMusic className="w-8 h-8 text-gray-800 mb-2" />
                          <p className="text-gray-600 text-xs">File vide</p>
                          {isHost && <p className="text-gray-700 text-[11px] mt-1">Ajoute des sons depuis Contrôles</p>}
                        </div>
                      : <AnimatePresence>
                          {queue.map((s, i) => (
                            <QueueItem key={s.id} song={s} index={i} isHost={isHost}
                              isNowPlaying={nowPlaying?.id === s.id}
                              onPlay={broadcastSong} onRemove={removeFromQueue} />
                          ))}
                        </AnimatePresence>
                    }
                  </div>
                )}

                {sideTab === 'controls' && (
                  <div className="space-y-3">
                    {isHost && (
                      <div className="lr-ctrl-card">
                        <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" />Contrôles Hôte</h3>
                        <div className="space-y-2">
                          <button onClick={() => { setShowPicker(!showPicker); setShowPlaylists(false); }}
                            className="lr-ctrl-btn">
                            <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />Chercher une musique
                          </button>
                          <button onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) loadMyPlaylists(); setShowPicker(false); }}
                            className="lr-ctrl-btn">
                            <BookOpen className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />Mes playlists
                          </button>
                          <input ref={fileInputRef} type="file"
                            accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/aac,audio/flac,audio/x-m4a,audio/*"
                            onChange={handleLocalFile} className="hidden" />
                          <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal}
                            className="lr-ctrl-btn disabled:opacity-40">
                            <Upload className="w-4 h-4 text-green-400" />{uploadingLocal ? 'Upload en cours…' : 'Importer un fichier local'}
                          </button>
                          {queue.length > 0 && (
                            <button onClick={skipToNext} className="lr-ctrl-btn">
                              <SkipForward className="w-4 h-4 text-cyan-400 flex-shrink-0" />Passer au suivant ({queue.length})
                            </button>
                          )}
                          {canStop && (
                            <button onClick={() => setConfirmModal('stop')} className="lr-ctrl-btn-danger">
                              <X className="w-4 h-4 flex-shrink-0" />Terminer le live
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Recherche de son */}
                    <AnimatePresence>
                      {showPicker && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="lr-ctrl-card overflow-hidden">
                          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Search className="w-4 h-4 text-cyan-400" />Recherche</h3>
                          <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
                            placeholder="Titre ou artiste…" autoFocus
                            className="lr-textarea w-full text-white px-4 py-3 text-sm mb-3 outline-none placeholder-gray-600" style={{borderRadius:14}} />
                          <div className="space-y-1 max-h-52 overflow-y-auto scrollbar-hide">
                            {songResults.map(s => (
                              <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-800 group transition-colors cursor-pointer">
                                {s.cover_url
                                  ? <img src={s.cover_url} alt={s.title} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                  : <div className="w-8 h-8 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><Music className="w-4 h-4 text-gray-500" /></div>
                                }
                                <div className="flex-1 min-w-0" onClick={() => broadcastSong(s)}>
                                  <p className="text-white text-xs font-medium truncate"><NoTranslate className="truncate"><NoTranslate className="truncate">{s.title}</NoTranslate></NoTranslate></p>
                                  <p className="text-gray-500 text-xs truncate"><NoTranslate className="truncate"><NoTranslate className="truncate">{s.artist}</NoTranslate></NoTranslate></p>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => broadcastSong(s)} className="p-1.5 text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 rounded-lg" title="Jouer maintenant"><Play className="w-3 h-3" /></button>
                                  <button onClick={() => addToQueue(s)} className="p-1.5 text-fuchsia-400 hover:text-fuchsia-300 bg-fuchsia-500/10 rounded-lg" title="Ajouter à la file"><Plus className="w-3 h-3" /></button>
                                </div>
                              </div>
                            ))}
                            {songSearch.trim() && songResults.length === 0 && <p className="text-gray-600 text-xs text-center py-4">Aucun résultat</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Mes playlists */}
                    <AnimatePresence>
                      {showPlaylists && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          className="lr-ctrl-card overflow-hidden">
                          <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-fuchsia-400" />Mes playlists</h3>
                          {loadingPlaylists
                            ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" /></div>
                            : myPlaylists.length === 0
                              ? <p className="text-gray-600 text-xs text-center py-4">Aucune playlist</p>
                              : <div className="space-y-1.5 max-h-52 overflow-y-auto scrollbar-hide">
                                  {myPlaylists.map(pl => (
                                    <div key={pl.id}
                                      onClick={() => addPlaylistToQueue(pl)}
                                      className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-800 cursor-pointer group transition-colors">
                                      {pl.cover_url
                                        ? <img src={pl.cover_url} alt={pl.name} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                                        : <div className="w-9 h-9 rounded-lg bg-gray-700 flex items-center justify-center flex-shrink-0"><ListMusic className="w-4 h-4 text-gray-500" /></div>
                                      }
                                      <div className="flex-1 min-w-0">
                                        <NoTranslate tag="p" className="text-white text-xs font-semibold truncate group-hover:text-fuchsia-300 transition-colors truncate">{pl.name}</NoTranslate>
                                        <p className="text-gray-500 text-[10px]">{(pl.playlist_songs || []).length} son{(pl.playlist_songs || []).length !== 1 ? 's' : ''}</p>
                                      </div>
                                      <Plus className="w-4 h-4 text-gray-600 group-hover:text-fuchsia-400 flex-shrink-0 transition-colors" />
                                    </div>
                                  ))}
                                </div>
                          }
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Infos room */}
                    <div className="lr-info-card">
                      <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-cyan-400" />Infos</h3>
                      <div className="space-y-2 text-xs mb-3">
                        <div className="flex justify-between items-center"><span className="text-gray-500">Statut</span><ConnBadge status={channelStatus} /></div>
                        <div className="flex justify-between"><span className="text-gray-500">Salle</span><span className="text-white font-medium truncate ml-2 max-w-[120px]">{room?.name}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Visibilité</span><span className={room?.is_private ? 'text-amber-400' : 'text-green-400'}>{room?.is_private ? '🔒 Privée' : '🌐 Publique'}</span></div>
                        {isHost && <div className="flex justify-between"><span className="text-gray-500">Durée</span><span className="text-green-400">{fmtDuration(liveDuration)}</span></div>}
                      </div>
                      <button onClick={copyLink} className="lr-ctrl-btn mt-2 text-xs justify-center">
                        {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Lien copié !</> : <><Copy className="w-3.5 h-3.5" />Copier le lien</>}
                      </button>
                      {/* V110000 — Partager dans le chat global */}
                      <button onClick={shareInGlobalChat} className="lr-ctrl-btn mt-1 text-xs justify-center">
                        {chatShared ? <><Check className="w-3.5 h-3.5 text-green-400" />Partagé dans le chat !</> : <><MessageCircle className="w-3.5 h-3.5 text-fuchsia-400" />Partager dans le chat global</>}
                      </button>
                    </div>

                    {!isHost && (
                      <button onClick={() => setConfirmModal('leave')}
                        className="w-full bg-gray-900 border border-gray-800 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 rounded-2xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2">
                        <LogOut className="w-4 h-4" />Quitter la salle
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Panneau mobile (bottom sheet) ──────────────────────── */}
      <AnimatePresence>
        {mobileSideOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setMobileSideOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-3xl max-h-[80vh] flex flex-col lr-sheet overflow-hidden">
              {/* Accent line */}
              <div className="h-px w-full flex-shrink-0" style={{background:'linear-gradient(90deg,transparent,rgba(6,182,212,0.6),rgba(168,85,247,0.5),transparent)'}}/>
              {/* Handle + tabs */}
              <div className="flex-shrink-0 px-4 pt-3 pb-2" style={{background:'rgba(4,4,16,0.98)'}}>
                <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{background:'rgba(255,255,255,0.12)'}}/>
                <div className="flex items-center justify-between">
                  <div className="flex rounded-2xl p-1 gap-1" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.07)'}}>
                    {[['participants','👥','Participants'],['queue','🎵','File'],['controls','⚙️','Ctrl']].map(([id,emoji,label]) => (
                      <button key={id} onClick={() => setSideTab(id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                        style={sideTab===id?{background:'rgba(6,182,212,0.12)',color:'#22d3ee',border:'1px solid rgba(6,182,212,0.2)'}:{color:'rgba(255,255,255,0.35)'}}>
                        {emoji} {label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setMobileSideOpen(false)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
                    style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)'}}>
                    <X className="w-4 h-4 text-gray-400"/>
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-8">
                {sideTab === 'participants' && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 mb-3">{participants.length} / {MAX_PARTICIPANTS} participants</p>
                    {participants.map(p => (
                      <div key={p.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-800 transition-colors">
                        <Avatar user={p} size={8} pulse />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate"><NoTranslate>{p.username}</NoTranslate></p>
                          {p.id === room?.host_id && <p className="text-amber-400 text-xs">Hôte 👑</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sideTab === 'queue' && (
                  <div>
                    <p className="text-xs text-gray-500 mb-3">{queue.length} son{queue.length !== 1 ? 's' : ''} dans la file</p>
                    {queue.length === 0
                      ? <p className="text-gray-600 text-sm text-center py-8">File vide</p>
                      : <AnimatePresence>
                          {queue.map((s, i) => (
                            <QueueItem key={s.id} song={s} index={i} isHost={isHost}
                              isNowPlaying={nowPlaying?.id === s.id}
                              onPlay={broadcastSong} onRemove={removeFromQueue} />
                          ))}
                        </AnimatePresence>
                    }
                  </div>
                )}

                {sideTab === 'controls' && (
                  <div className="space-y-2.5">
                    {isHost ? (
                      <>
                        <button onClick={() => { setShowPicker(!showPicker); setShowPlaylists(false); }}
                          className="lr-ctrl-btn">
                          <Search className="w-4 h-4 text-cyan-400 flex-shrink-0" />Chercher une musique
                        </button>
                        <button onClick={() => { setShowPlaylists(!showPlaylists); if (!showPlaylists) loadMyPlaylists(); setShowPicker(false); }}
                          className="lr-ctrl-btn">
                          <BookOpen className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />Mes playlists
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={uploadingLocal}
                          className="lr-ctrl-btn disabled:opacity-40">
                          <Upload className="w-4 h-4 text-green-400 flex-shrink-0" />{uploadingLocal ? 'Upload…' : 'Fichier local (MP3, WAV…)'}
                        </button>
                        {queue.length > 0 && (
                          <button onClick={() => { skipToNext(); setMobileSideOpen(false); }}
                            className="lr-ctrl-btn">
                            <SkipForward className="w-4 h-4 text-cyan-400 flex-shrink-0" />Passer au suivant
                          </button>
                        )}
                        {canStop && (
                          <button onClick={() => { setConfirmModal('stop'); setMobileSideOpen(false); }}
                            className="w-full bg-red-600/20 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2">
                            <X className="w-4 h-4" />Terminer le live
                          </button>
                        )}
                        {/* V110000 — Pause mobile */}
                        {isHost && (
                          <button onClick={() => { togglePause(); }}
                            className={`w-full rounded-xl px-4 py-3 text-sm transition-all flex items-center gap-2 border ${liveIsPaused ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'}`}>
                            {liveIsPaused ? <><Play className="w-4 h-4" />Reprendre le live</> : <><Pause className="w-4 h-4" />Mettre en pause</>}
                          </button>
                        )}

                        {/* Picker dans le panneau mobile */}
                        {showPicker && (
                          <div className="bg-gray-800 rounded-2xl p-3">
                            <input value={songSearch} onChange={e => setSongSearch(e.target.value)}
                              placeholder="Titre ou artiste…" autoFocus
                              className="w-full bg-gray-700 border border-gray-600 text-white rounded-xl px-4 py-3 text-base mb-3 focus:outline-none focus:border-cyan-500 placeholder-gray-500" />
                            <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                              {songResults.map(s => (
                                <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-gray-700 cursor-pointer transition-colors"
                                  onClick={() => { broadcastSong(s); setMobileSideOpen(false); }}>
                                  {s.cover_url ? <img src={s.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0"><Music className="w-3 h-3 text-gray-400" /></div>}
                                  <div className="flex-1 min-w-0"><p className="text-white text-xs font-medium truncate"><NoTranslate className="truncate"><NoTranslate className="truncate">{s.title}</NoTranslate></NoTranslate></p><p className="text-gray-400 text-[10px] truncate"><NoTranslate className="truncate"><NoTranslate className="truncate">{s.artist}</NoTranslate></NoTranslate></p></div>
                                  <div className="flex gap-1">
                                    <button onClick={e => { e.stopPropagation(); broadcastSong(s); setMobileSideOpen(false); }} className="p-1 text-cyan-400 hover:bg-cyan-500/10 rounded"><Play className="w-3 h-3" /></button>
                                    <button onClick={e => { e.stopPropagation(); addToQueue(s); }} className="p-1 text-fuchsia-400 hover:bg-fuchsia-500/10 rounded"><Plus className="w-3 h-3" /></button>
                                  </div>
                                </div>
                              ))}
                              {songSearch.trim() && songResults.length === 0 && <p className="text-gray-500 text-xs text-center py-3">Aucun résultat</p>}
                            </div>
                          </div>
                        )}

                        {/* Playlists dans le panneau mobile */}
                        {showPlaylists && (
                          <div className="bg-gray-800 rounded-2xl p-3">
                            {loadingPlaylists
                              ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-fuchsia-400 animate-spin" /></div>
                              : myPlaylists.length === 0
                                ? <p className="text-gray-500 text-xs text-center py-4">Aucune playlist trouvée</p>
                                : myPlaylists.map(pl => (
                                  <div key={pl.id} onClick={() => { addPlaylistToQueue(pl); setMobileSideOpen(false); }}
                                    className="flex items-center gap-2.5 p-2.5 rounded-xl hover:bg-gray-700 cursor-pointer transition-colors mb-1">
                                    {pl.cover_url ? <img src={pl.cover_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" /> : <div className="w-9 h-9 rounded-lg bg-gray-600 flex items-center justify-center flex-shrink-0"><ListMusic className="w-4 h-4 text-gray-400" /></div>}
                                    <div className="flex-1 min-w-0"><NoTranslate tag="p" className="text-white text-xs font-semibold truncate truncate">{pl.name}</NoTranslate><p className="text-gray-500 text-[10px]">{(pl.playlist_songs || []).length} sons</p></div>
                                    <Plus className="w-4 h-4 text-fuchsia-400 flex-shrink-0" />
                                  </div>
                                ))
                            }
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="bg-gray-800 rounded-2xl p-4 text-center">
                          <Volume2 className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                          <p className="text-white text-sm font-semibold mb-1">Mode Auditeur</p>
                          <p className="text-gray-500 text-xs">Tu écoutes le live de <NoTranslate tag="span">{room?.host?.username}</NoTranslate></p>
                          <div className="mt-3 flex items-center justify-center gap-2">
                            <span className="text-xs text-gray-500">Sync :</span>
                            <span className={`text-sm font-bold ${syncQuality > 70 ? 'text-green-400' : syncQuality > 40 ? 'text-amber-400' : 'text-red-400'}`}>{syncQuality}%</span>
                          </div>
                        </div>
                        <button onClick={() => { setConfirmModal('leave'); setMobileSideOpen(false); }}
                          className="w-full bg-gray-900 border border-gray-700 hover:border-red-500/40 hover:bg-red-500/5 text-gray-400 hover:text-red-400 rounded-2xl px-4 py-3 text-sm transition-all flex items-center justify-center gap-2">
                          <LogOut className="w-4 h-4" />Quitter la salle
                        </button>
                      </>
                    )}
                    <button onClick={copyLink} className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-xs transition-all flex items-center justify-center gap-2">
                      {copied ? <><Check className="w-3.5 h-3.5 text-green-400" />Lien copié !</> : <><Copy className="w-3.5 h-3.5" />Copier le lien</>}
                    </button>
                    {/* V110000 — Partager dans le chat global (mobile) */}
                    <button onClick={() => { shareInGlobalChat(); setMobileSideOpen(false); }}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-xs transition-all flex items-center justify-center gap-2">
                      {chatShared ? <><Check className="w-3.5 h-3.5 text-green-400" />Partagé !</> : <><MessageCircle className="w-3.5 h-3.5 text-fuchsia-400" />Partager dans le chat global</>}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modals de confirmation ─────────────────────────────── */}
      <AnimatePresence>
        {confirmModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
            onClick={e => { if (e.target === e.currentTarget) setConfirmModal(null); }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 mx-auto ${confirmModal === 'stop' ? 'bg-red-500/15' : 'bg-amber-500/15'}`}>
                {confirmModal === 'stop' ? <X className="w-6 h-6 text-red-400" /> : <LogOut className="w-6 h-6 text-amber-400" />}
              </div>
              <h3 className="text-white font-bold text-lg text-center mb-2">
                {confirmModal === 'stop' ? 'Terminer le live ?' : 'Quitter la salle ?'}
              </h3>
              <p className="text-gray-400 text-sm text-center mb-6">
                {confirmModal === 'stop'
                  ? 'Cette action mettra fin à la session pour tous les participants.'
                  : "Tu pourras revenir en utilisant le lien d'invitation."}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors">
                  Annuler
                </button>
                <button onClick={() => { leaveRoom(); setConfirmModal(null); }}
                  className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors ${confirmModal === 'stop' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                  {confirmModal === 'stop' ? 'Terminer' : 'Quitter'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
        <Footer />
    </>
  );
};

export default LiveRoomPage;
