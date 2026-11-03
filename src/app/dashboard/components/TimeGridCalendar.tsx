"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import {
  DEFAULT_HOUR_HEIGHT,
  MAX_HOUR_HEIGHT,
  MIN_HOUR_HEIGHT,
  anchoredScrollTop,
  clampHourHeight,
  getSaoPauloNowMinutes,
  initialScrollMinutes,
  layoutOverlaps,
  minutesToOffset,
  pinchHourHeight,
} from "@/lib/timeGrid";
import { minutesToTime } from "@/lib/timezone";

export interface TimeGridEvent {
  id: string;
  start: number; // minutos desde 00:00
  end: number;
  kind: "lead" | "free" | "blocked" | "expired";
  title: string;
  subtitle?: string;
  color: string; // cor de fundo (agendamento) ou de destaque (livre/bloqueado)
  textColor?: string;
  highlight?: boolean; // destaque ao mover/arrastar um agendamento
  dimmed?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  acceptsDrop?: boolean;
}

export interface TimeGridDay {
  dateStr: string;
  weekdayLabel: string;
  dayNumber: string;
  isToday: boolean;
  isPast: boolean;
  badge?: string;
  onHeaderClick?: () => void;
  events: TimeGridEvent[];
}

interface Props {
  days: TimeGridDay[];
  scrollKey: string; // muda ao trocar de dia/semana para reposicionar a rolagem
}

const STORAGE_KEY = "retoria.agenda.hourHeight";
const GUTTER = 52;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const readStoredHeight = (): number => {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return v ? clampHourHeight(v) : DEFAULT_HOUR_HEIGHT;
  } catch {
    return DEFAULT_HOUR_HEIGHT;
  }
};

const storeHeight = (h: number) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(h)));
  } catch {
    // armazenamento indisponível (aba anônima): o zoom só não fica salvo
  }
};

const touchDistance = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

// Grade de horários das visões Dia e Semana, com pinça para "espremer" ou ampliar as horas (como no Google Agenda).
export default function TimeGridCalendar({ days, scrollKey }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // A grade só aparece depois que a agenda carrega no navegador, então ler o zoom salvo aqui não gera divergência de hidratação.
  const [hourHeight, setHourHeight] = useState(() => (typeof window === "undefined" ? DEFAULT_HOUR_HEIGHT : readStoredHeight()));
  const heightRef = useRef(hourHeight);
  const pendingScrollRef = useRef<number | null>(null);
  const [nowMinutes, setNowMinutes] = useState(() => getSaoPauloNowMinutes());

  useEffect(() => {
    const id = window.setInterval(() => setNowMinutes(getSaoPauloNowMinutes()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Aplica a rolagem calculada na mesma pintura da nova altura, sem "pulo" na tela.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el && pendingScrollRef.current !== null) {
      el.scrollTop = pendingScrollRef.current;
      pendingScrollRef.current = null;
    }
  }, [hourHeight]);

  const zoomTo = (newHeight: number, focusClientY?: number) => {
    const el = scrollRef.current;
    const oldHeight = heightRef.current;
    const next = clampHourHeight(newHeight);
    if (!el || next === oldHeight) return;
    const header = headerRef.current?.offsetHeight ?? 0;
    const rect = el.getBoundingClientRect();
    const focusY = focusClientY !== undefined ? focusClientY - rect.top - header : (el.clientHeight - header) / 2;
    const gridScroll = el.scrollTop;
    pendingScrollRef.current = anchoredScrollTop(gridScroll, Math.max(0, focusY), oldHeight, next);
    heightRef.current = next;
    setHourHeight(next);
  };

  // Gestos: pinça com dois dedos (toque) e Ctrl + roda / pinça do touchpad (computador).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pinch: { distance: number; height: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        pinch = { distance: touchDistance(e.touches[0], e.touches[1]), height: heightRef.current };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      zoomTo(pinchHourHeight(pinch.height, pinch.distance, touchDistance(e.touches[0], e.touches[1])), midY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (pinch && e.touches.length < 2) {
        pinch = null;
        storeHeight(heightRef.current);
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomTo(heightRef.current * Math.exp(-e.deltaY * 0.01), e.clientY);
      storeHeight(heightRef.current);
    };
    const onGesture = (e: Event) => e.preventDefault(); // Safari/iOS: evita o zoom da página inteira

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("gesturestart", onGesture);
    el.addEventListener("gesturechange", onGesture);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGesture);
      el.removeEventListener("gesturechange", onGesture);
    };
  }, []);

  // Ao trocar de dia/semana, rola até a hora atual (hoje) ou até o primeiro bloco.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const starts = days.flatMap((d) => d.events.map((ev) => ev.start));
    const first = starts.length ? Math.min(...starts) : null;
    const showsToday = days.some((d) => d.isToday);
    el.scrollTop = minutesToOffset(initialScrollMinutes(first, showsToday ? getSaoPauloNowMinutes() : null), heightRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollKey]);

  const stepZoom = (factor: number) => {
    zoomTo(heightRef.current * factor);
    storeHeight(heightRef.current);
  };

  const gridHeight = hourHeight * 24;
  const multiDay = days.length > 1;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/20 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800/80">
        <span className="text-[10px] text-slate-500 font-semibold">Pince com dois dedos para ajustar as horas</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Diminuir horas"
            onClick={() => stepZoom(1 / 1.25)}
            disabled={hourHeight <= MIN_HOUR_HEIGHT}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Aumentar horas"
            onClick={() => stepZoom(1.25)}
            disabled={hourHeight >= MAX_HOUR_HEIGHT}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 disabled:opacity-30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="relative h-[70vh] min-h-[420px] overflow-y-auto overscroll-contain" style={{ touchAction: "pan-x pan-y" }}>
        {/* Cabeçalho dos dias, fixo no topo enquanto rola */}
        <div ref={headerRef} className="sticky top-0 z-20 flex border-b border-slate-800 bg-slate-950/95 backdrop-blur">
          <div style={{ width: GUTTER }} className="shrink-0" />
          {days.map((d) => (
            <button
              key={d.dateStr}
              type="button"
              onClick={d.onHeaderClick}
              disabled={!d.onHeaderClick}
              className={`flex-1 min-w-0 py-2 flex flex-col items-center gap-0.5 ${d.isPast ? "opacity-50" : ""}`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${d.isToday ? "text-indigo-400" : "text-slate-500"}`}>{d.weekdayLabel}</span>
              <span
                className={`flex items-center justify-center rounded-full font-black ${multiDay ? "h-7 w-7 text-sm" : "h-9 w-9 text-lg"} ${d.isToday ? "bg-indigo-600 text-white" : "text-slate-200"}`}
              >
                {d.dayNumber}
              </span>
              {d.badge && <span className="text-[9px] font-extrabold text-red-400 truncate max-w-full px-0.5">{d.badge}</span>}
            </button>
          ))}
        </div>

        <div className="relative flex" style={{ height: gridHeight }}>
          {/* Coluna das horas */}
          <div style={{ width: GUTTER }} className="shrink-0 relative">
            {HOURS.map((h) =>
              h === 0 ? null : (
                <span
                  key={h}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold text-slate-500 tabular-nums"
                  style={{ top: h * hourHeight }}
                >
                  {minutesToTime(h * 60)}
                </span>
              )
            )}
          </div>

          {days.map((d) => {
            const placements = layoutOverlaps(d.events);
            return (
              <div
                key={d.dateStr}
                className={`relative flex-1 min-w-0 border-l border-slate-800/70 ${d.isPast ? "bg-slate-950/30" : ""}`}
                style={{
                  backgroundImage: `linear-gradient(to bottom, rgba(128,128,128,0.22) 1px, transparent 1px)${
                    hourHeight >= 96 ? ", linear-gradient(to bottom, rgba(128,128,128,0.09) 1px, transparent 1px)" : ""
                  }`,
                  backgroundSize: `100% ${hourHeight}px${hourHeight >= 96 ? `, 100% ${hourHeight / 2}px` : ""}`,
                }}
              >
                {d.events.map((ev) => {
                  const place = placements.get(ev.id) ?? { col: 0, cols: 1 };
                  const top = minutesToOffset(ev.start, hourHeight);
                  const height = Math.max(minutesToOffset(ev.end - ev.start, hourHeight) - 2, 16);
                  const compact = height < 34 || (multiDay && height < 44);
                  const timeLabel = `${minutesToTime(ev.start)} – ${minutesToTime(ev.end)}`;
                  const isLead = ev.kind === "lead";
                  const style: React.CSSProperties = {
                    top,
                    height,
                    left: `calc(${(place.col / place.cols) * 100}% + 2px)`,
                    width: `calc(${100 / place.cols}% - 4px)`,
                  };
                  if (isLead) {
                    style.backgroundColor = ev.color;
                    style.color = ev.textColor ?? "#fff";
                  } else if (ev.kind === "free") {
                    style.backgroundColor = ev.color + "14";
                    style.border = `1px dashed ${ev.color}80`;
                    style.color = ev.color;
                  } else if (ev.kind === "blocked") {
                    style.backgroundImage = `repeating-linear-gradient(135deg, ${ev.color}22 0 6px, transparent 6px 12px)`;
                    style.border = `1px solid ${ev.color}40`;
                    style.color = ev.color;
                  } else {
                    style.border = "1px solid rgba(128,128,128,0.25)";
                  }
                  return (
                    <div
                      key={ev.id}
                      role={ev.onClick ? "button" : undefined}
                      tabIndex={ev.onClick ? 0 : undefined}
                      onClick={ev.onClick}
                      onKeyDown={(e) => {
                        if (ev.onClick && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          ev.onClick();
                        }
                      }}
                      draggable={ev.draggable}
                      onDragStart={ev.onDragStart}
                      onDragEnd={ev.onDragEnd}
                      onDragOver={ev.acceptsDrop ? (e) => e.preventDefault() : undefined}
                      onDrop={ev.onDrop}
                      title={`${timeLabel} · ${ev.title}${ev.subtitle ? ` · ${ev.subtitle}` : ""}`}
                      className={`absolute z-10 overflow-hidden rounded-md px-1.5 text-left leading-tight transition-[filter,opacity] ${
                        ev.onClick ? "cursor-pointer hover:brightness-110" : ""
                      } ${ev.kind === "expired" ? "text-slate-500 opacity-50" : ""} ${ev.dimmed ? "opacity-40" : ""} ${
                        ev.highlight ? "ring-2 ring-indigo-500/70" : ""
                      } ${compact ? "py-0.5" : "py-1"}`}
                      style={style}
                    >
                      {compact ? (
                        <div className="truncate text-[10px] font-bold">
                          {!multiDay && <span className="font-mono mr-1 opacity-80">{minutesToTime(ev.start)}</span>}
                          {ev.title}
                        </div>
                      ) : (
                        <>
                          <div className={`truncate font-bold ${multiDay ? "text-[10px]" : "text-xs"}`}>{ev.title}</div>
                          <div className={`truncate font-mono opacity-80 ${multiDay ? "text-[9px]" : "text-[10px]"}`}>{timeLabel}</div>
                          {ev.subtitle && height >= 56 && (
                            <div className={`truncate opacity-80 ${multiDay ? "text-[9px]" : "text-[10px]"}`}>{ev.subtitle}</div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                {d.isToday && nowMinutes !== null && (
                  <div className="pointer-events-none absolute left-0 right-0 z-30" style={{ top: minutesToOffset(nowMinutes, hourHeight) }}>
                    <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-0.5 bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
