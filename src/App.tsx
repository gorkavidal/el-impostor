/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, UserPlus, X, Play, RotateCcw, Eye, EyeOff, User, Pencil, Shuffle, HelpCircle, ChevronUp, ChevronDown, Save, FolderOpen, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { WORDS, type WordEntry } from './words';

type GameState = 'setup' | 'playing' | 'confirm' | 'finished';
type GameMode = 'classic' | 'uncertainty';

interface Player {
  id: string;
  name: string;
}

interface SavedList {
  name: string;
  players: Player[];
}

function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / (0xFFFFFFFF + 1);
}

function cryptoRandomInt(max: number): number {
  return Math.floor(cryptoRandom() * max);
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SAVED_LISTS_KEY = 'impostor-saved-lists';
const LAST_LIST_KEY = 'impostor-last-players';

function loadSavedLists(): SavedList[] {
  try {
    const raw = localStorage.getItem(SAVED_LISTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveLists(lists: SavedList[]) {
  try { localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(lists)); } catch {}
}

function loadLastPlayers(): Player[] | null {
  try {
    const raw = localStorage.getItem(LAST_LIST_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function persistLastPlayers(players: Player[]) {
  try { localStorage.setItem(LAST_LIST_KEY, JSON.stringify(players)); } catch {}
}

const DEFAULT_PLAYERS: Player[] = [
  { id: '1', name: 'Jugador 1' },
  { id: '2', name: 'Jugador 2' },
  { id: '3', name: 'Jugador 3' },
];

export default function App() {
  const [gameState, setGameState] = useState<GameState>('setup');
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [hintsEnabled, setHintsEnabled] = useState(false);
  const [players, setPlayers] = useState<Player[]>(() => loadLastPlayers() ?? DEFAULT_PLAYERS);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [impostorIds, setImpostorIds] = useState<Set<string>>(new Set());
  const [currentEntry, setCurrentEntry] = useState<WordEntry | null>(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [round, setRound] = useState(1);
  const [isPressed, setIsPressed] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>(loadSavedLists);
  const [saveListName, setSaveListName] = useState('');
  const recentImpostorIds = useRef<string[]>([]);

  useEffect(() => {
    if (gameState === 'setup') persistLastPlayers(players);
  }, [players, gameState]);

  const addPlayer = () => {
    if (newPlayerName.trim()) {
      setPlayers([...players, { id: crypto.randomUUID(), name: newPlayerName.trim() }]);
      setNewPlayerName('');
    }
  };

  const removePlayer = (id: string) => {
    if (players.length > 3) {
      setPlayers(players.filter(p => p.id !== id));
    }
  };

  const updatePlayerName = (id: string, name: string) => {
    setPlayers(players.map(p => p.id === id ? { ...p, name } : p));
  };

  const movePlayer = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= players.length) return;
    const next = [...players];
    [next[index], next[target]] = [next[target], next[index]];
    setPlayers(next);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const startGame = () => {
    const playerIds = players.map(p => p.id);
    const maxRecent = Math.max(1, players.length - 1);
    const recentSet = new Set(recentImpostorIds.current.slice(-maxRecent));

    let chosenIds: Set<string>;

    if (gameMode === 'classic') {
      const eligible = playerIds.filter(id => !recentSet.has(id));
      const pool = eligible.length > 0 ? eligible : playerIds;
      const pick = pool[cryptoRandomInt(pool.length)];
      chosenIds = new Set([pick]);
    } else {
      const numImpostors = cryptoRandomInt(players.length - 1) + 1;
      const shuffled = shuffleArray<string>(playerIds);
      chosenIds = new Set<string>(shuffled.slice(0, numImpostors));
    }

    recentImpostorIds.current.push(...Array.from(chosenIds));
    if (recentImpostorIds.current.length > players.length * 3) {
      recentImpostorIds.current = recentImpostorIds.current.slice(-players.length);
    }

    const randomEntry = WORDS[cryptoRandomInt(WORDS.length)];
    setImpostorIds(chosenIds);
    setCurrentEntry(randomEntry);
    setCurrentPlayerIndex(0);
    setGameState('playing');
    setIsPressed(false);
    if (gameState === 'finished') {
      setRound(prev => prev + 1);
    }

    if (navigator.vibrate) navigator.vibrate(50);
  };

  const nextPlayer = () => {
    if (currentPlayerIndex < players.length - 1) {
      setCurrentPlayerIndex(currentPlayerIndex + 1);
      setIsPressed(false);
    } else {
      setIsPressed(false);
      setGameState('confirm');
    }
  };

  const revealResults = () => {
    setGameState('finished');
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#dc2626', '#ef4444', '#000000']
    });
  };

  const shufflePlayers = () => {
    setPlayers(shuffleArray(players));
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const resetGame = () => {
    setGameState('setup');
    recentImpostorIds.current = [];
    setRound(1);
  };

  const saveCurrentList = () => {
    if (!saveListName.trim()) return;
    const newList: SavedList = { name: saveListName.trim(), players: [...players] };
    const updated = [...savedLists.filter(l => l.name !== newList.name), newList];
    setSavedLists(updated);
    saveLists(updated);
    setSaveListName('');
    setShowSaveDialog(false);
  };

  const loadList = (list: SavedList) => {
    setPlayers(list.players.map(p => ({ ...p, id: crypto.randomUUID() })));
    setShowLoadDialog(false);
  };

  const deleteList = (name: string) => {
    const updated = savedLists.filter(l => l.name !== name);
    setSavedLists(updated);
    saveLists(updated);
  };

  const isImpostor = (playerIndex: number) => impostorIds.has(players[playerIndex].id);
  const impostorPlayers = players.filter(p => impostorIds.has(p.id));

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans selection:bg-red-200">
      <div className="max-w-md mx-auto px-6 py-8 flex flex-col min-h-screen">

        <header className="mb-8 text-center relative">
          {gameState !== 'setup' && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="absolute left-0 top-1/2 -translate-y-1/2"
            >
              <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                R{round}
              </div>
            </motion.div>
          )}
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-red-600 mb-1">
            El Impostor
          </h1>
          <p className="text-xs font-mono uppercase tracking-widest opacity-50">
            Juego de engaño y deducción
          </p>
        </header>

        <main className="flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            {gameState === 'setup' && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-black/5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-red-600" />
                      <h2 className="font-bold text-lg">Jugadores ({players.length})</h2>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setShowRules(true)}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"
                        title="Reglas"
                      >
                        <HelpCircle size={18} />
                      </button>
                      <button
                        onClick={() => setShowLoadDialog(true)}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"
                        title="Cargar lista"
                      >
                        <FolderOpen size={18} />
                      </button>
                      <button
                        onClick={() => { setSaveListName(''); setShowSaveDialog(true); }}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"
                        title="Guardar lista"
                      >
                        <Save size={18} />
                      </button>
                      <button
                        onClick={shufflePlayers}
                        className="p-2 hover:bg-red-50 rounded-xl text-red-600 transition-colors"
                        title="Mezclar orden"
                      >
                        <Shuffle size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {players.map((player, index) => (
                      <div key={player.id} className="flex items-center gap-1 bg-[#F5F2ED] p-2 pl-1 rounded-2xl">
                        <div className="flex flex-col shrink-0">
                          <button
                            onClick={() => movePlayer(index, -1)}
                            disabled={index === 0}
                            className="p-0.5 text-black/20 hover:text-red-600 disabled:opacity-0 transition-colors"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => movePlayer(index, 1)}
                            disabled={index === players.length - 1}
                            className="p-0.5 text-black/20 hover:text-red-600 disabled:opacity-0 transition-colors"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>
                        {editingPlayerId === player.id ? (
                          <input
                            autoFocus
                            value={player.name}
                            onChange={(e) => updatePlayerName(player.id, e.target.value)}
                            onBlur={() => setEditingPlayerId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingPlayerId(null)}
                            className="flex-1 bg-white border-none rounded-xl px-2 py-1 outline-none font-medium text-red-600 min-w-0"
                          />
                        ) : (
                          <span
                            className="font-medium flex-1 cursor-pointer truncate pl-1"
                            onClick={() => setEditingPlayerId(player.id)}
                          >
                            {player.name}
                          </span>
                        )}
                        {players.length > 3 && (
                          <button
                            onClick={() => removePlayer(player.id)}
                            className="p-1.5 hover:bg-red-100 rounded-full text-red-400 hover:text-red-600 transition-colors shrink-0"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
                      placeholder="Nombre del jugador..."
                      className="flex-1 bg-[#F5F2ED] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none transition-all min-w-0"
                    />
                    <button
                      onClick={addPlayer}
                      className="bg-red-600 text-white p-3 rounded-2xl hover:bg-red-700 active:scale-95 transition-all"
                    >
                      <UserPlus size={24} />
                    </button>
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-black/5">
                  <h3 className="text-xs font-mono uppercase tracking-widest opacity-40 mb-3 text-center">Modo de Juego</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setGameMode('classic')}
                      className={`py-3 rounded-2xl font-bold text-sm transition-all ${gameMode === 'classic' ? 'bg-red-600 text-white shadow-md' : 'bg-[#F5F2ED] text-black/40 hover:bg-red-50'}`}
                    >
                      CLÁSICO
                    </button>
                    <button
                      onClick={() => setGameMode('uncertainty')}
                      className={`py-3 rounded-2xl font-bold text-sm transition-all ${gameMode === 'uncertainty' ? 'bg-red-600 text-white shadow-md' : 'bg-[#F5F2ED] text-black/40 hover:bg-red-50'}`}
                    >
                      INCERTIDUMBRE
                    </button>
                  </div>
                  <p className="text-[10px] text-center mt-3 opacity-40 leading-tight">
                    {gameMode === 'classic' ? '1 impostor garantizado.' : 'Número de impostores secreto (de 1 a N-1).'}
                  </p>
                </div>

                {/* Hint Toggle */}
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-black/5">
                  <button
                    onClick={() => setHintsEnabled(!hintsEnabled)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-bold text-sm">Pista para el impostor</span>
                      <span className="text-[10px] opacity-40 mt-0.5">
                        {hintsEnabled ? 'El impostor recibe una palabra relacionada.' : 'Sin pistas. Dificultad máxima.'}
                      </span>
                    </div>
                    <div className={`w-12 h-7 rounded-full transition-all relative ${hintsEnabled ? 'bg-red-600' : 'bg-black/10'}`}>
                      <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all ${hintsEnabled ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>

                <button
                  onClick={startGame}
                  disabled={players.length < 3}
                  className="w-full bg-black text-white py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-black/10 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale"
                >
                  <Play fill="currentColor" size={20} />
                  EMPEZAR PARTIDA
                </button>
                {players.length < 3 && (
                  <p className="text-center text-xs text-red-500 font-medium">Se necesitan al menos 3 jugadores</p>
                )}
              </motion.div>
            )}

            {gameState === 'playing' && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="flex-1 flex flex-col items-center justify-center relative"
              >
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 bg-red-100 text-red-700 px-4 py-1 rounded-full text-sm font-bold mb-4">
                    <User size={14} />
                    TURNO DE
                  </div>
                  <h2 className="text-5xl font-black tracking-tight uppercase break-words px-4">
                    {players[currentPlayerIndex].name}
                  </h2>
                </div>

                <div className="relative w-full aspect-[3/4] max-w-[300px] mb-8">
                  <div className="absolute inset-0 bg-white rounded-[40px] shadow-xl border border-black/5 flex flex-col items-center justify-center p-8 text-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      {isPressed ? (
                        <motion.div
                          key="secret"
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex flex-col items-center"
                        >
                          <span className="text-xs font-mono uppercase tracking-[0.3em] opacity-40 mb-2">
                            {isImpostor(currentPlayerIndex) ? 'Tu rol secreto' : 'Tu palabra secreta'}
                          </span>
                          <h3 className="text-4xl font-black tracking-tighter uppercase text-red-600">
                            {isImpostor(currentPlayerIndex) ? 'Impostor' : currentEntry?.word}
                          </h3>
                          {isImpostor(currentPlayerIndex) && hintsEnabled && currentEntry && (
                            <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-600">Pista</span>
                              <p className="text-lg font-bold text-amber-700 mt-1">{currentEntry.hint}</p>
                            </div>
                          )}
                          <div className="mt-6 p-4 bg-[#F5F2ED] rounded-2xl text-xs font-medium opacity-60 leading-relaxed">
                            {isImpostor(currentPlayerIndex)
                              ? (hintsEnabled
                                ? "Tienes una pista. Úsala para disimular, pero cuidado: no es la palabra exacta."
                                : "¡No tienes palabra! Intenta descubrir de qué hablan los demás.")
                              : "No dejes que el impostor descubra esta palabra."}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="hidden"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center opacity-20"
                        >
                          <EyeOff size={80} />
                          <p className="mt-4 font-bold uppercase tracking-widest text-sm">Contenido oculto</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex w-full gap-3 px-4">
                  <button
                    onPointerDown={() => {
                      setIsPressed(true);
                      if (navigator.vibrate) navigator.vibrate(10);
                    }}
                    onPointerUp={() => setIsPressed(false)}
                    onPointerLeave={() => setIsPressed(false)}
                    className="flex-1 bg-red-600 text-white py-5 rounded-3xl font-bold text-lg flex flex-col items-center justify-center gap-1 shadow-lg shadow-red-600/20 active:scale-95 transition-all select-none touch-none"
                  >
                    <Eye size={20} />
                    <span>MANTENER</span>
                  </button>

                  <button
                    onClick={nextPlayer}
                    className="flex-1 bg-black text-white py-5 rounded-3xl font-bold text-lg flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/10 active:scale-95 transition-all"
                  >
                    <Play size={20} fill="currentColor" />
                    <span>SIGUIENTE</span>
                  </button>
                </div>

                <p className="mt-6 text-[10px] font-medium opacity-30 text-center uppercase tracking-widest">
                  Mantén pulsado el botón rojo para ver tu palabra
                </p>
              </motion.div>
            )}

            {gameState === 'confirm' && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center"
                >
                  <Users size={48} />
                </motion.div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold">Todos han visto su carta</h2>
                  <p className="opacity-50 text-sm px-4">
                    Es hora de debatir. Cuando estéis listos, revelad quién es el impostor.
                  </p>
                </div>
                <button
                  onClick={revealResults}
                  className="w-full bg-red-600 text-white py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
                >
                  <Eye size={20} />
                  RESOLVER RONDA
                </button>
              </motion.div>
            )}

            {gameState === 'finished' && (
              <motion.div
                key="finished"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
              >
                <div className="space-y-2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <Eye size={40} />
                  </motion.div>
                  <h2 className="text-3xl font-bold">¡Ronda terminada!</h2>
                  <p className="opacity-60">Es hora de debatir y votar.</p>
                </div>

                <div className="bg-white p-8 rounded-[40px] shadow-sm border border-black/5 w-full relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
                  <span className="text-xs font-mono uppercase tracking-widest opacity-40">
                    {impostorPlayers.length > 1 ? 'Los impostores eran...' : 'El impostor era...'}
                  </span>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5, type: 'spring' }}
                    className="mt-4 flex flex-wrap justify-center gap-2"
                  >
                    {impostorPlayers.map(p => (
                      <div key={p.id} className="text-2xl font-black text-red-600 uppercase tracking-tighter bg-red-50 px-3 py-1 rounded-xl">
                        {p.name}
                      </div>
                    ))}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="mt-6 pt-6 border-t border-black/5"
                  >
                    <span className="text-xs font-mono uppercase tracking-widest opacity-40">La palabra era</span>
                    <div className="text-2xl font-bold uppercase mt-1 text-red-600">{currentEntry?.word}</div>
                  </motion.div>
                  {gameMode === 'uncertainty' && (
                    <div className="mt-4 text-[10px] font-mono uppercase tracking-widest opacity-30">
                      Modo Incertidumbre: Había {impostorPlayers.length} {impostorPlayers.length === 1 ? 'impostor' : 'impostores'}.
                    </div>
                  )}
                </div>

                <div className="flex flex-col w-full gap-3">
                  <button
                    onClick={startGame}
                    className="w-full bg-red-600 text-white py-5 rounded-3xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
                  >
                    <RotateCcw size={20} />
                    NUEVA RONDA
                  </button>
                  <button
                    onClick={resetGame}
                    className="w-full bg-black/5 text-black/40 py-4 rounded-3xl font-bold text-sm uppercase tracking-widest hover:bg-black/10 transition-all"
                  >
                    VOLVER AL INICIO
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Rules Modal */}
        <AnimatePresence>
          {showRules && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setShowRules(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-[40px] w-full max-w-sm p-8 max-h-[80vh] overflow-y-auto custom-scrollbar relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowRules(false)}
                  className="absolute top-6 right-6 p-2 hover:bg-red-50 rounded-full text-red-600 transition-colors"
                >
                  <X size={24} />
                </button>

                <h2 className="text-2xl font-black uppercase italic text-red-600 mb-6">Reglas del Juego</h2>

                <div className="space-y-6 text-sm">
                  <section>
                    <h3 className="font-bold uppercase tracking-widest text-xs opacity-40 mb-2">Objetivo</h3>
                    <p className="leading-relaxed">
                      Cada jugador recibe una palabra secreta. El <span className="text-red-600 font-bold italic">Impostor</span> no recibe nada y debe disimular.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-bold uppercase tracking-widest text-xs opacity-40 mb-2">Cómo jugar</h3>
                    <ul className="list-disc pl-4 space-y-2 leading-relaxed">
                      <li>Por turnos, cada uno dice una palabra relacionada con su tarjeta.</li>
                      <li><span className="font-bold">Cuidado:</span> Si eres muy obvio, el impostor adivinará la palabra. Si eres muy raro, pensarán que tú eres el impostor.</li>
                      <li>Tras varias rondas, se debate y se vota quién es el impostor.</li>
                    </ul>
                  </section>

                  <section className="bg-red-50 p-4 rounded-2xl">
                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-red-600 mb-2">Modo Incertidumbre</h3>
                    <p className="text-xs leading-relaxed text-red-800">
                      ¡Nadie sabe cuántos impostores hay! Puede haber desde uno solo hasta casi todos. Esto añade paranoia: ¿estás solo o tienes aliados? ¿Es ese jugador raro un impostor o solo alguien confundido?
                    </p>
                  </section>

                  <section className="bg-amber-50 p-4 rounded-2xl">
                    <h3 className="font-bold uppercase tracking-widest text-[10px] text-amber-700 mb-2">Pista para el impostor</h3>
                    <p className="text-xs leading-relaxed text-amber-800">
                      Si se activa esta opción, el impostor recibe una palabra relacionada con la palabra secreta (pero no es la misma). Esto le da una ventaja para disimular, pero también hace el juego más interesante.
                    </p>
                  </section>

                  <section>
                    <h3 className="font-bold uppercase tracking-widest text-xs opacity-40 mb-2">Victoria</h3>
                    <p className="leading-relaxed">
                      Los jugadores ganan si descubren a <span className="font-bold underline">todos</span> los impostores. El impostor gana si sobrevive sin ser votado.
                    </p>
                  </section>
                </div>

                <button
                  onClick={() => setShowRules(false)}
                  className="w-full bg-black text-white py-4 rounded-2xl font-bold mt-8 active:scale-95 transition-all"
                >
                  ¡ENTENDIDO!
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Save List Dialog */}
        <AnimatePresence>
          {showSaveDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setShowSaveDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-sm p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-lg mb-4">Guardar lista</h3>
                <p className="text-xs opacity-50 mb-3">
                  {players.map(p => p.name).join(', ')}
                </p>
                <input
                  autoFocus
                  type="text"
                  value={saveListName}
                  onChange={(e) => setSaveListName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveCurrentList()}
                  placeholder="Nombre de la lista..."
                  className="w-full bg-[#F5F2ED] border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-red-500 outline-none mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSaveDialog(false)}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm bg-black/5 text-black/40"
                  >
                    CANCELAR
                  </button>
                  <button
                    onClick={saveCurrentList}
                    disabled={!saveListName.trim()}
                    className="flex-1 py-3 rounded-2xl font-bold text-sm bg-red-600 text-white disabled:opacity-50"
                  >
                    GUARDAR
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Load List Dialog */}
        <AnimatePresence>
          {showLoadDialog && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
              onClick={() => setShowLoadDialog(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl w-full max-w-sm p-6 max-h-[70vh] overflow-y-auto custom-scrollbar"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-bold text-lg mb-4">Cargar lista</h3>
                {savedLists.length === 0 ? (
                  <p className="text-sm opacity-40 text-center py-8">No hay listas guardadas.</p>
                ) : (
                  <div className="space-y-2">
                    {savedLists.map((list) => (
                      <div key={list.name} className="flex items-center gap-2 bg-[#F5F2ED] p-3 rounded-2xl">
                        <button
                          onClick={() => loadList(list)}
                          className="flex-1 text-left min-w-0"
                        >
                          <span className="font-bold text-sm block truncate">{list.name}</span>
                          <span className="text-[10px] opacity-40 block truncate">
                            {list.players.map(p => p.name).join(', ')}
                          </span>
                        </button>
                        <button
                          onClick={() => deleteList(list.name)}
                          className="p-2 hover:bg-red-100 rounded-full text-red-500 transition-colors shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setShowLoadDialog(false)}
                  className="w-full py-3 rounded-2xl font-bold text-sm bg-black/5 text-black/40 mt-4"
                >
                  CERRAR
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-8 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest opacity-20">
            &copy; {new Date().getFullYear()} El Impostor App
          </p>
        </footer>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
