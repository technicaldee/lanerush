"use client";

import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { AnimationAction, Group } from "three";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import confetti from "canvas-confetti";
import { useAccount } from "wagmi";
import { useGameStore } from "@/lib/gameStore";

const lanePositions = [-3.6, -1.2, 1.2, 3.6];
const segmentLength = 24;
const gateOffset = 1.5;
const runSpeed = 5;
const questionDuration = 8;
const segmentBuffer = 5;
const recycleThreshold = -segmentLength * 1.25;
const swipeThresholdPx = 44;
const jumpImpulse = 9.2;
const gravity = 38;
const laneColors = ["#ef4444", "#22c55e", "#3b82f6", "#facc15"];

let finishLineTexture: THREE.CanvasTexture | null = null;

function getFinishLineTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") {
    return null;
  }
  if (finishLineTexture) {
    return finishLineTexture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const g = canvas.getContext("2d");
  if (!g) {
    return null;
  }
  const cols = 16;
  const rows = 8;
  const cw = canvas.width / cols;
  const ch = canvas.height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#0a0a0a";
      g.fillRect(x * cw, y * ch, cw, ch);
    }
  }
  finishLineTexture = new THREE.CanvasTexture(canvas);
  finishLineTexture.wrapS = THREE.RepeatWrapping;
  finishLineTexture.wrapT = THREE.RepeatWrapping;
  finishLineTexture.repeat.set(14, 2);
  finishLineTexture.colorSpace = THREE.SRGBColorSpace;
  finishLineTexture.needsUpdate = true;
  return finishLineTexture;
}

type SegmentData = {
  id: number;
  z: number;
  questionIndex: number;
};

function buildSegments(questionCount: number): SegmentData[] {
  if (questionCount < 1) {
    return [];
  }
  return Array.from({ length: segmentBuffer }, (_, index) => ({
    id: index,
    z: index * segmentLength,
    questionIndex: index % questionCount,
  }));
}

const PlayerModel = forwardRef<Group>(function PlayerModel(_, ref) {
  const animRoot = useRef<Group>(null);
  const gltf = useGLTF("/run.glb") as any;
  const { actions } = useAnimations(gltf.animations, animRoot);
  const running = useGameStore((state) => state.status === "running");

  useEffect(() => {
    const action = Object.values(actions)[0] as AnimationAction | undefined;
    if (!action) {
      return;
    }
    if (running) {
      action.reset().fadeIn(0.2).play();
      action.setEffectiveTimeScale(1);
    } else {
      action.play();
      action.setEffectiveTimeScale(0);
    }
  }, [actions, running]);

  return (
    <group ref={ref} position={[0, 0.05, 0]} rotation={[0, 0, 0]}>
      <group ref={animRoot} scale={1.25}>
        <primitive object={gltf.scene} />
      </group>
    </group>
  );
});

function Segment({
  data,
  isActive,
  segmentRef,
}: {
  data: SegmentData;
  isActive: boolean;
  segmentRef: (node: Group | null) => void;
}) {
  const tapeTex = useMemo(() => getFinishLineTexture(), []);

  return (
    <group ref={segmentRef} position={[0, 0, data.z]}>
      <mesh receiveShadow position={[0, -0.07, segmentLength / 2]}>
        <boxGeometry args={[8.8, 0.16, segmentLength]} />
        <meshStandardMaterial
          color={isActive ? "#0f1522" : "#0b111d"}
          roughness={0.98}
          metalness={0.05}
        />
      </mesh>

      {lanePositions.map((x, lane) => (
        <mesh key={`lane-tile-${lane}`} receiveShadow position={[x, -0.002, segmentLength / 2]}>
          <boxGeometry args={[2.08, 0.05, segmentLength - 0.15]} />
          <meshStandardMaterial
            color={laneColors[lane] ?? "#334155"}
            emissive={laneColors[lane] ?? "#000000"}
            emissiveIntensity={isActive ? 0.35 : 0.2}
            roughness={0.72}
            metalness={0.06}
          />
        </mesh>
      ))}

      <mesh position={[-2.6, 0.02, segmentLength / 2]}>
        <boxGeometry args={[0.12, 0.04, segmentLength]} />
        <meshStandardMaterial color="#41d7ff" emissive="#0a2030" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[-0.2, 0.02, segmentLength / 2]}>
        <boxGeometry args={[0.08, 0.04, segmentLength]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[2.2, 0.02, segmentLength / 2]}>
        <boxGeometry args={[0.08, 0.04, segmentLength]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {lanePositions.map((x, lane) => (
        <group key={lane}>
          <mesh position={[x, 0.03, segmentLength / 2]}>
            <boxGeometry args={[2.12, 0.02, segmentLength - 0.7]} />
            <meshStandardMaterial
              color={laneColors[lane] ?? "#334155"}
              emissive={laneColors[lane] ?? "#000000"}
              emissiveIntensity={0.28}
              transparent={false}
              opacity={1}
            />
          </mesh>
          <mesh position={[x, 0.055, segmentLength / 2]}>
            <boxGeometry args={[2.16, 0.01, segmentLength - 0.85]} />
            <meshStandardMaterial
              color={laneColors[lane] ?? "#334155"}
              emissive={laneColors[lane] ?? "#000000"}
              emissiveIntensity={0.18}
              roughness={0.4}
              metalness={0.12}
            />
          </mesh>
        </group>
      ))}

      <group position={[0, 1.52, segmentLength - 1.9]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[8.65, 0.32]} />
          <meshStandardMaterial
            color="#ffffff"
            map={tapeTex ?? undefined}
            roughness={0.4}
            metalness={0.08}
            emissive={isActive ? "#2a2210" : "#0a0a0a"}
            emissiveIntensity={isActive ? 0.35 : 0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[-4.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.32, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position={[4.35, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.32, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.35} />
        </mesh>
      </group>
      <mesh position={[-4.2, 0.95, segmentLength - 2.4]}>
        <boxGeometry args={[0.16, 1.9, 0.16]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[4.2, 0.95, segmentLength - 2.4]}>
        <boxGeometry args={[0.16, 1.9, 0.16]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
    </group>
  );
}

function GameScene({ jumpDispatchRef }: { jumpDispatchRef: React.MutableRefObject<(() => void) | null> }) {
  const questionBank = useGameStore((state) => state.questionBank);
  const [segments, setSegments] = useState<SegmentData[]>(() =>
    buildSegments(useGameStore.getState().questionBank.length),
  );
  const segmentRefs = useRef<(Group | null)[]>([]);
  const segmentZs = useRef<number[]>(segments.map((segment) => segment.z));
  const playerRef = useRef<Group>(null);
  const playerLaneX = useRef(lanePositions[1]);
  const jumpVel = useRef(0);
  const jumpY = useRef(0);
  const activeSegmentIdRef = useRef<number | null>(null);
  const resolvedSegmentIdRef = useRef<number | null>(null);
  const nextQuestionIndexRef = useRef(segments.length);

  const targetLane = useGameStore((state) => state.targetLane);
  const status = useGameStore((state) => state.status);
  const restartSeed = useGameStore((state) => state.restartSeed);
  const activeQuestionIndex = useGameStore((state) => state.activeQuestionIndex);
  const setActiveQuestionIndex = useGameStore((state) => state.setActiveQuestionIndex);
  const setAliveCount = useGameStore((state) => state.setAliveCount);
  const setStatus = useGameStore((state) => state.setStatus);
  const setTimeLeft = useGameStore((state) => state.setTimeLeft);
  const setPoolCount = useGameStore((state) => state.setPoolCount);

  const resetTrack = () => {
    const len = useGameStore.getState().questionBank.length;
    const next = buildSegments(len);
    segmentZs.current = next.map((segment) => segment.z);
    segmentRefs.current.forEach((ref, index) => {
      if (ref) {
        ref.position.z = next[index].z;
      }
    });
    segmentRefs.current.length = next.length;
    activeSegmentIdRef.current = null;
    resolvedSegmentIdRef.current = null;
    nextQuestionIndexRef.current = next.length;
    playerLaneX.current = lanePositions[1];
    if (playerRef.current) {
      playerRef.current.position.x = lanePositions[1];
      playerRef.current.position.y = 0.05;
      playerRef.current.rotation.y = 0;
    }
    jumpVel.current = 0;
    jumpY.current = 0;
    setSegments(next);
    setPoolCount(next.length);
    setActiveQuestionIndex(0);
    setTimeLeft(questionDuration);
  };

  useEffect(() => {
    resetTrack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartSeed, questionBank.length]);

  const tryJump = useCallback(() => {
    if (status !== "running") {
      return;
    }
    if (jumpY.current <= 0.001 && jumpVel.current <= 0) {
      jumpVel.current = jumpImpulse;
    }
  }, [status]);

  useEffect(() => {
    jumpDispatchRef.current = tryJump;
    return () => {
      jumpDispatchRef.current = null;
    };
  }, [jumpDispatchRef, tryJump]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (status !== "running") {
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        useGameStore.getState().setTargetLane(Math.max(0, targetLane - 1));
      } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        useGameStore.getState().setTargetLane(Math.min(lanePositions.length - 1, targetLane + 1));
      } else if (event.key === "ArrowUp" || event.key === " " || event.key.toLowerCase() === "w") {
        event.preventDefault();
        tryJump();
      } else if (event.key >= "1" && event.key <= "4") {
        const nextLane = Number(event.key) - 1;
        useGameStore.getState().setTargetLane(nextLane);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, targetLane, tryJump]);

  const resolveSegment = (segment: SegmentData) => {
    if (resolvedSegmentIdRef.current === segment.id || status !== "running") {
      return;
    }

    resolvedSegmentIdRef.current = segment.id;
    const lane = useGameStore.getState().targetLane;
    const bank = useGameStore.getState().questionBank;
    const question = bank[segment.questionIndex];
    if (!question) {
      return;
    }

    if (lane === question.correctIndex) {
      useGameStore.setState((s) => ({
        score: s.score + 100,
        correctAnswers: s.correctAnswers + 1,
      }));
      const nextAlive = Math.max(1, useGameStore.getState().aliveCount - 1);
      setAliveCount(nextAlive);
      setTimeLeft(0);

      if (nextAlive === 1) {
        useGameStore.setState((s) => ({
          score: s.score + s.lives * 50,
          status: "won",
        }));
      }
    } else {
      const nextLives = Math.max(0, useGameStore.getState().lives - 1);
      useGameStore.setState({ lives: nextLives });
      setTimeLeft(0);
      if (nextLives <= 0) {
        setStatus("eliminated");
      }
    }
  };

  useFrame((_, delta) => {
    if (useGameStore.getState().questionBank.length < 1) {
      return;
    }
    if (status !== "running") {
      return;
    }

    const nextLaneX = lanePositions[targetLane] ?? lanePositions[1];
    playerLaneX.current += (nextLaneX - playerLaneX.current) * Math.min(1, delta * 10);

    jumpVel.current -= gravity * delta;
    jumpY.current += jumpVel.current * delta;
    if (jumpY.current < 0) {
      jumpY.current = 0;
      jumpVel.current = 0;
    }

    const bob = Math.sin(performance.now() * 0.004) * 0.035;
    if (playerRef.current) {
      playerRef.current.position.x = playerLaneX.current;
      playerRef.current.position.y = 0.05 + bob + jumpY.current;
    }

    const activeIdBefore = activeSegmentIdRef.current;
    let activeSegmentId: number | null = null;
    let farthestZ = Number.NEGATIVE_INFINITY;

    segments.forEach((segment, index) => {
      const nextZ = segmentZs.current[index] - runSpeed * delta;
      segmentZs.current[index] = nextZ;
      const ref = segmentRefs.current[index];
      if (ref) {
        ref.position.z = nextZ;
      }
      if (nextZ > farthestZ) {
        farthestZ = nextZ;
      }
      if (nextZ <= 0 && nextZ + segmentLength > 0) {
        activeSegmentId = segment.id;
      }
    });

    const activeSegment = activeSegmentId === null ? null : segments.find((segment) => segment.id === activeSegmentId) ?? null;

    if (activeSegment !== null && activeSegment.id !== activeIdBefore) {
      activeSegmentIdRef.current = activeSegment.id;
      resolvedSegmentIdRef.current = null;
      setActiveQuestionIndex(activeSegment.questionIndex);
      setTimeLeft(questionDuration);
    }

    segments.forEach((segment, index) => {
      const currentZ = segmentZs.current[index];
      if (currentZ + segmentLength < recycleThreshold) {
        const recycledZ = farthestZ + segmentLength;
        segmentZs.current[index] = recycledZ;
        const ref = segmentRefs.current[index];
        if (ref) {
          ref.position.z = recycledZ;
        }
        farthestZ = recycledZ;

        const qLen = useGameStore.getState().questionBank.length;
        const nextQuestionIndex = qLen > 0 ? nextQuestionIndexRef.current % qLen : 0;
        nextQuestionIndexRef.current += 1;
        setSegments((current) =>
          current.map((item) =>
            item.id === segment.id ? { ...item, questionIndex: nextQuestionIndex } : item,
          ),
        );
      }
    });

    const activeSegmentForResolve = segments.find(
      (_, index) => segmentZs.current[index] <= 0 && segmentZs.current[index] + segmentLength > 0,
    );

    if (activeSegmentForResolve) {
      const segmentIndex = segments.findIndex((segment) => segment.id === activeSegmentForResolve.id);
      const gateZ = segmentZs.current[segmentIndex] + segmentLength - gateOffset;
      const remaining = useGameStore.getState().timeLeft - delta;
      if (remaining <= 0) {
        resolveSegment(activeSegmentForResolve);
      } else {
        setTimeLeft(remaining);
        if (gateZ <= 0) {
          resolveSegment(activeSegmentForResolve);
        }
      }
    }
  });

  return (
    <>
      <color attach="background" args={["#07111f"]} />
      <fog attach="fog" args={["#07111f", 16, 80]} />

      <ambientLight intensity={0.85} />
      <directionalLight position={[6, 12, 8]} intensity={1.6} color="#f7d39b" />
      <directionalLight position={[-6, 8, -6]} intensity={0.7} color="#41d7ff" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 24]}>
        <planeGeometry args={[36, 140]} />
        <meshStandardMaterial color="#050913" roughness={1} metalness={0} />
      </mesh>

      <PlayerModel ref={playerRef} />

      {segments.map((segment, index) => {
        const q = questionBank[segment.questionIndex];
        if (!q) {
          return null;
        }
        return (
          <Segment
            key={segment.id}
            data={{ ...segment, z: segmentZs.current[index] }}
            isActive={segment.id === activeSegmentIdRef.current && segment.questionIndex === activeQuestionIndex}
            segmentRef={(node) => {
              segmentRefs.current[index] = node;
              if (node) {
                node.position.z = segmentZs.current[index];
              }
            }}
          />
        );
      })}
    </>
  );
}

function PayoutOnWin() {
  const status = useGameStore((state) => state.status);
  const { address } = useAccount();
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    if (status === "idle" || status === "running") {
      setRequested(false);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "won" || requested) {
      return;
    }
    const id = useGameStore.getState().stakeId;
    if (id === null || !address) {
      return;
    }
    setRequested(true);
    void fetch("/api/payout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stakeId: id.toString(), playerAddress: address }),
    }).catch((err) => console.error("payout", err));
  }, [status, requested, address]);

  return null;
}

function WinConfettiFX() {
  const status = useGameStore((state) => state.status);
  useEffect(() => {
    if (status !== "won") {
      return;
    }
    const count = 200;
    const defaults = { origin: { y: 0.62 } };
    const fire = (particleRatio: number, opts: Parameters<typeof confetti>[0]) => {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    };
    fire(0.25, { spread: 28, startVelocity: 52 });
    fire(0.22, { spread: 62 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.85 });
    fire(0.12, { spread: 120, startVelocity: 24, decay: 0.92, scalar: 1.15 });
    const t = window.setInterval(() => {
      confetti({ particleCount: 18, angle: 60, spread: 48, origin: { x: 0, y: 0.58 } });
      confetti({ particleCount: 18, angle: 120, spread: 48, origin: { x: 1, y: 0.58 } });
    }, 420);
    const stop = window.setTimeout(() => window.clearInterval(t), 2400);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(stop);
    };
  }, [status]);
  return null;
}

function Hud() {
  const status = useGameStore((state) => state.status);
  const lives = useGameStore((state) => state.lives);
  const score = useGameStore((state) => state.score);
  const correctAnswers = useGameStore((state) => state.correctAnswers);
  const targetLane = useGameStore((state) => state.targetLane);
  const questionBank = useGameStore((state) => state.questionBank);
  const activeQuestionIndex = useGameStore((state) => state.activeQuestionIndex);
  const returnToTitle = useGameStore((state) => state.returnToTitle);
  const activeQuestion = questionBank[activeQuestionIndex];

  return (
    <div className="hud-layer">
      <PayoutOnWin />
      <WinConfettiFX />
      {status === "running" ? (
        <>
          {activeQuestion ? (
            <div className="hud-question-panel">
              <p className="hud-question-panel__title">{activeQuestion.question}</p>
              <div className="hud-question-panel__options">
                {lanePositions.map((_, lane) => (
                  <div
                    key={lane}
                    className="hud-question-option"
                    data-active={targetLane === lane ? "true" : undefined}
                    style={{ ["--lane-color" as string]: laneColors[lane] }}
                  >
                    <span className="hud-question-option__swatch" />
                    <span className="hud-question-option__label">{activeQuestion.options[lane] ?? "--"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="hud-lives-clean" aria-label={`Lives left: ${lives} out of 3`}>
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="hud-heart"
                data-active={index < lives ? "true" : undefined}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" role="img">
                  <path d="M12 21.2 10.9 20.2C5.2 15 1.5 11.7 1.5 7.6 1.5 4.3 4.1 1.7 7.4 1.7c1.9 0 3.7.9 4.8 2.3 1.1-1.4 2.9-2.3 4.8-2.3 3.3 0 5.9 2.6 5.9 5.9 0 4.1-3.7 7.4-9.4 12.6L12 21.2Z" />
                </svg>
              </span>
            ))}
          </div>

          <div className="hud-stats-arcade">
            <div className="arcade-chip arcade-chip--score">
              <span className="arcade-chip__label">Score</span>
              <span className="arcade-chip__value">{score}</span>
            </div>
          </div>
        </>
      ) : null}

      {status === "won" || status === "eliminated" ? (
        <div className="game-overlay game-overlay--result">
          <div className="game-overlay-card game-overlay-card--result">
            <p className="game-overlay-kicker">{status === "won" ? "Victory lap" : "Wiped out"}</p>
            <h2 className="game-overlay-title game-overlay-title--result">
              {status === "won" ? "You won" : "Eliminated"}
            </h2>
            <dl className="game-scoreboard">
              <div className="game-scoreboard__row">
                <dt>Final score</dt>
                <dd>{score}</dd>
              </div>
              <div className="game-scoreboard__row">
                <dt>Gates cleared</dt>
                <dd>{correctAnswers}</dd>
              </div>
              {status === "won" ? (
                <div className="game-scoreboard__row game-scoreboard__row--bonus">
                  <dt>Finish bonus</dt>
                  <dd>+{lives * 50} pts</dd>
                </div>
              ) : null}
            </dl>
            <div className="game-overlay-actions">
              <button type="button" className="game-btn-primary" onClick={returnToTitle}>
                Back to menu (new stake for next run)
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ArcadeRunnerGame() {
  const hasQuestions = useGameStore((state) => state.questionBank.length > 0);
  const status = useGameStore((state) => state.status);
  const jumpDispatchRef = useRef<(() => void) | null>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [canvasKey, setCanvasKey] = useState(0);
  const [isRecoveringContext, setIsRecoveringContext] = useState(false);

  const onCanvasCreated = useCallback((state: { gl: THREE.WebGLRenderer }) => {
    const canvas = state.gl.domElement;
    const existingCleanup = (canvas as HTMLCanvasElement & { __cleanupLaneRush?: () => void }).__cleanupLaneRush;
    existingCleanup?.();

    const onContextLost = (event: Event) => {
      event.preventDefault();
      setIsRecoveringContext(true);
      window.setTimeout(() => {
        setCanvasKey((prev) => prev + 1);
      }, 80);
    };
    const onContextRestored = () => {
      setIsRecoveringContext(false);
    };

    canvas.addEventListener("webglcontextlost", onContextLost as EventListener, { passive: false });
    canvas.addEventListener("webglcontextrestored", onContextRestored as EventListener);
    (canvas as HTMLCanvasElement & { __cleanupLaneRush?: () => void }).__cleanupLaneRush = () => {
      canvas.removeEventListener("webglcontextlost", onContextLost as EventListener);
      canvas.removeEventListener("webglcontextrestored", onContextRestored as EventListener);
    };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) {
      return;
    }

    const store = useGameStore.getState();
    if (store.status !== "running") {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx >= absDy && absDx > swipeThresholdPx) {
      if (dx < 0) {
        store.setTargetLane(Math.max(0, store.targetLane - 1));
      } else {
        store.setTargetLane(Math.min(lanePositions.length - 1, store.targetLane + 1));
      }
    } else if (absDy > absDx && dy < -swipeThresholdPx) {
      jumpDispatchRef.current?.();
    }
  };

  const onPointerCancel = () => {
    swipeStartRef.current = null;
  };

  return (
    <div className="game-shell">
      <div
        className="game-canvas-wrap"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {hasQuestions ? (
          <Canvas key={canvasKey} camera={{ position: [0, 6.2, 12], fov: 50 }} dpr={[1, 1.25]} onCreated={onCanvasCreated}>
            <GameScene jumpDispatchRef={jumpDispatchRef} />
          </Canvas>
        ) : status === "running" ? (
          <div className="game-loading">
            <p className="game-loading__title">Loading track...</p>
            <p className="game-loading__hint">Your round is readying assets.</p>
          </div>
        ) : (
          <div className="game-canvas-placeholder" aria-hidden />
        )}
        {isRecoveringContext ? (
          <div className="game-loading">
            <div>
              <p className="game-loading__title">Recovering graphics...</p>
              <p className="game-loading__hint">WebGL context was lost. Rebuilding scene.</p>
            </div>
          </div>
        ) : null}
      </div>
      <Hud />
    </div>
  );
}

useGLTF.preload("/run.glb");
