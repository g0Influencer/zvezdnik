import { useRef, useState } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { NatalChartArt } from "./NatalChartArt";
import { haptic } from "@/lib/telegram";
import { reachGoal } from "@/lib/metrika";

/* ============================================================
   Интерактивный лонгрид «Натальная карта»
   Контент одинаковый для всех пользователей.
   ============================================================ */

/* ---------- UI bits ---------- */

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70 mb-3">{children}</p>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-15% 0px -15% 0px", once: false });
  return (
    <motion.section
      ref={ref}
      animate={{ opacity: inView ? 1 : 0.35, y: inView ? 0 : 12 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className={`py-12 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.8] text-foreground/90">{children}</p>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 pl-4 border-l border-foreground/40">
      <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1.5">Короткая подсказка</p>
      <p className="font-serif italic text-[16px] leading-[1.55] text-foreground/90">{children}</p>
    </div>
  );
}

/* ---------- Tiny shared widgets ---------- */

/* (FeedbackRow removed) */

function AskButtons({ questions, label = "Задать вопрос звезднику" }: { questions: string[]; label?: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        onClick={() => {
          haptic("light");
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] px-4 py-2 rounded-full border border-foreground/70 text-foreground hover:bg-foreground hover:text-background transition-colors"
      >
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1 overflow-hidden"
          >
            {questions.map((q) => (
              <li key={q}>
                <button
                  onClick={() => {
                    haptic("light");
                    try {
                      sessionStorage.setItem("void_prefill", q);
                    } catch {}
                    reachGoal("natal_ask_void" as never);
                    navigate("/void");
                  }}
                  className="w-full text-left flex items-start gap-2 py-2 px-3 rounded-md border border-border hover:border-foreground/40 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                  <span className="text-[13px] leading-[1.5] text-foreground/90">{q}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   1. Hero
   ============================================================ */

function HeroBlock() {
  const wrap = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: wrap, offset: ["start end", "end start"] });
  const rotate = useTransform(scrollYProgress, [0, 1], [-25, 25]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.92, 1, 0.95]);

  const highlights = [
    { sym: "☉", name: "Солнце", hint: "как ты проявляешь себя" },
    { sym: "☽", name: "Луна", hint: "как ты чувствуешь" },
    { sym: "Asc", name: "Асцендент", hint: "как тебя видят" },
  ];

  return (
    <div ref={wrap} className="relative flex flex-col items-center pt-2 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-4"
      >
        <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground mb-2">
          небо в момент твоего рождения
        </p>
        <h2 className="font-serif text-[28px] leading-tight">Твоя натальная карта</h2>
      </motion.div>

      <motion.div style={{ rotate, scale }} className="w-full max-w-[320px] mb-6">
        <NatalChartArt birthDate="shared" className="w-full h-auto" />
      </motion.div>

      <div className="w-full space-y-4">
        <P>
          Это не прогноз и не приговор. Это карта твоих привычных реакций, внутренних опор, желаний и
          повторяющихся сценариев.
        </P>
        <P>
          Ниже — личный разбор по твоей карте. Он показывает не то, какой ты должна быть, а то, как ты чаще
          всего чувствуешь, выбираешь, защищаешься, сближаешься с людьми и восстанавливаешь силы.
        </P>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {highlights.map((h) => (
            <div key={h.name} className="border border-border rounded-sm p-3 text-center">
              <div className="font-serif text-[20px] leading-none mb-1.5">{h.sym}</div>
              <div className="text-[12px] font-medium">{h.name}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1 leading-snug">
                {h.hint}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   2. Главное о тебе
   ============================================================ */

function MainAboutYou() {
  return (
    <Section>
      <Kicker>Главное о тебе</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">Что карта говорит о тебе в целом</h3>
      <div className="space-y-5">
        <P>
          В тебе много внутренней наблюдательности. Ты можешь казаться спокойнее, чем чувствуешь себя на самом
          деле, потому что не всегда показываешь первое волнение наружу.
        </P>
        <P>
          Тебе важно понимать, что происходит и почему. Случайность, хаос и неопределённость быстро забирают у
          тебя силы. В отношениях и делах ты ищешь не просто красивых слов, а ощущения надёжности.
        </P>
        <P>
          Если внутри нет опоры, ты можешь начать всё анализировать, перепроверять и заранее готовиться к
          разочарованию. Твоя сильная сторона — способность видеть нюансы. Твоя зона роста — не превращать эту
          чувствительность в постоянный контроль.
        </P>
      </div>
      
    </Section>
  );
}

/* ============================================================
   3. Три главные энергии (Солнце / Луна / Асцендент)
   ============================================================ */

const ENERGIES = [
  {
    sym: "☉",
    name: "Солнце",
    role: "как ты проявляешь себя",
    hint: "Ты сильнее всего чувствуешь себя собой, когда выбираешь не из страха, а из ясного внутреннего согласия.",
    body: [
      "Солнце показывает, где ты чувствуешь свою силу и через что раскрываешься. Это не только про характер, а про способ действовать, выбирать и занимать место в жизни.",
      "Тебе важно не просто делать что-то правильно, а чувствовать, что в этом есть твой смысл. Когда ты действуешь из внутренней ясности, в тебе появляется спокойная уверенность. Когда приходится слишком долго жить чужими ожиданиями, энергия начинает уходить.",
    ],
  },
  {
    sym: "☽",
    name: "Луна",
    role: "как ты чувствуешь",
    hint: "Твоё спокойствие начинается там, где ты перестаёшь спорить со своим состоянием.",
    body: [
      "Луна показывает, что тебе нужно для эмоциональной безопасности. Она говорит о том, как ты реагируешь, когда тревожно, больно, непонятно или слишком много всего сразу.",
      "Тебе важно не только разобраться головой, но и почувствовать, что внутри стало тише. Иногда ты можешь понимать ситуацию логически, но всё равно не чувствовать спокойствия. Это значит, что тебе нужна не новая версия объяснения, а опора: тело, пространство, близкий голос, пауза, понятное действие.",
    ],
  },
  {
    sym: "Asc",
    name: "Асцендент",
    role: "как тебя видят другие",
    hint: "Окружающие могут считывать тебя проще, чем ты ощущаешь себя изнутри.",
    body: [
      "Асцендент показывает первое впечатление, которое ты производишь, и роль, через которую чаще всего заходишь в мир. Иногда люди видят только внешнюю оболочку и не сразу понимают, сколько всего происходит у тебя внутри.",
      "Ты можешь выглядеть собраннее, легче или увереннее, чем ощущаешь себя на самом деле. Из-за этого другие не всегда замечают, когда тебе нужна поддержка. Тебе важно не ждать, что тебя угадают, а постепенно учиться показывать больше настоящего.",
    ],
  },
];

function EnergyCard({ e, i }: { e: (typeof ENERGIES)[number]; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ delay: i * 0.08, duration: 0.5 }}
      className="border border-border rounded-sm overflow-hidden"
    >
      <button
        onClick={() => {
          haptic("light");
          setOpen((v) => !v);
        }}
        className="w-full text-left p-5 flex items-start gap-4"
      >
        <div className="w-12 h-12 shrink-0 rounded-full border border-foreground/70 flex items-center justify-center font-serif text-[18px]">
          {e.sym}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[18px] mb-0.5">{e.name}</div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">{e.role}</div>
          <div className="text-[13px] leading-[1.6] text-foreground/80 italic">{e.hint}</div>
        </div>
        <ChevronDown
          className={`h-4 w-4 mt-1 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-secondary/30"
          >
            <div className="p-5 space-y-4">
              {e.body.map((t, idx) => (
                <P key={idx}>{t}</P>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ThreeEnergies() {
  return (
    <Section>
      <Kicker>Три главные энергии</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-3">Солнце, Луна и Асцендент</h3>
      <p className="text-[14px] leading-[1.7] text-muted-foreground mb-6">
        Три точки, с которых начинают читать любую карту. Нажми на карточку, чтобы раскрыть подробное описание.
      </p>
      <div className="space-y-3">
        {ENERGIES.map((e, i) => (
          <EnergyCard key={e.name} e={e} i={i} />
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   4. Как ты реагируешь на стресс
   ============================================================ */

function StressSection() {
  return (
    <Section>
      <Kicker>Как ты реагируешь на стресс</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">Когда внутри тревожно</h3>
      <div className="space-y-5">
        <P>
          Когда ситуация становится неопределённой, ты можешь начинать искать дополнительные знаки: перечитывать
          сообщения, вспоминать интонации, прокручивать разговоры и пытаться понять, что на самом деле имелось в
          виду.
        </P>
        <P>
          Снаружи это может выглядеть как собранность, но внутри в этот момент идёт активная попытка вернуть
          контроль. Чем меньше ясности, тем сильнее хочется всё разложить по местам.
        </P>
        <P>
          Тебе помогает не бесконечный анализ, а простое действие, которое возвращает в реальность: прогулка,
          душ, порядок на столе, короткий список из трёх понятных шагов. Чем яснее становится ближайшее
          действие, тем меньше власти у тревоги.
        </P>
      </div>
      <Hint>Когда хочется всё срочно понять, сначала вернись к телу и простым действиям.</Hint>
      <AskButtons
        label="Задать вопрос о тревоге"
        questions={[
          "Почему мне сейчас тревожно?",
          "Что мне поможет вернуть спокойствие?",
          "Что я пытаюсь контролировать?",
          "Какой маленький шаг мне сейчас нужен?",
        ]}
      />
    </Section>
  );
}

/* ============================================================
   5. Отношения
   ============================================================ */

function RelationshipsSection() {
  const navigate = useNavigate();
  return (
    <Section>
      <Kicker>Отношения</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">Что с тобой происходит в близости</h3>
      <div className="space-y-5">
        <P>
          В близости тебе важно чувствовать, что человек не исчезнет в момент, когда становится сложно. Ты
          можешь казаться независимой, но всё равно тонко считываешь паузы, изменения тона и маленькие сдвиги в
          поведении.
        </P>
        <P>
          Если ясности мало, внутри может включаться сценарий додумывания. Ты пытаешься понять отношение
          человека по деталям: как ответил, как посмотрел, почему замолчал, что имел в виду. Иногда это помогает
          заметить важное, но иногда только усиливает тревогу.
        </P>
        <P>
          Тебе нужна связь, где есть не только притяжение, но и устойчивость. Твоя точка роста — не проверять
          любовь через тревогу, а говорить о своих чувствах раньше, чем накопится холодность.
        </P>
      </div>
      <Hint>Близость становится спокойнее, когда её не нужно всё время угадывать.</Hint>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            haptic("light");
            reachGoal("natal_open_compatibility" as never);
            navigate("/compatibility");
          }}
          className="text-[11px] uppercase tracking-[0.25em] px-4 py-2 rounded-full border border-foreground bg-foreground text-background hover:opacity-90 transition-opacity"
        >
          Посмотреть совместимость
        </button>
      </div>

      <AskButtons
        label="Задать вопрос про отношения"
        questions={[
          "Что мне важно понять об этих отношениях?",
          "Почему меня тянет к этому человеку?",
          "Где я додумываю вместо того, чтобы спросить?",
          "Что мне нужно для спокойной близости?",
        ]}
      />
    </Section>
  );
}

/* ============================================================
   6. Работа и деньги
   ============================================================ */

function WorkMoneySection() {
  return (
    <Section>
      <Kicker>Работа и деньги</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">Где ты ищешь смысл и опору</h3>
      <div className="space-y-5">
        <P>
          В работе тебе важно видеть смысл, а не просто закрывать задачи. Ты можешь долго держаться на
          ответственности и делать больше, чем от тебя ждут, особенно если чувствуешь, что без тебя всё
          развалится.
        </P>
        <P>
          Но если результат не ощущается твоим, быстро появляется усталость и внутреннее сопротивление. Ты
          можешь продолжать справляться внешне, но внутри уже чувствовать, что старая роль стала тесной.
        </P>
        <P>
          В деньгах для тебя важна не только сумма, но и чувство опоры. Когда нет ясности в цифрах, тревога
          становится сильнее. Тебе подходит не жёсткий контроль, а спокойная система: понятные цели, регулярный
          учёт и право не решать всё сразу.
        </P>
      </div>
      <Hint>Тебе легче двигаться вперёд, когда есть не давление, а понятная опора.</Hint>
      <AskButtons
        label="Задать вопрос про работу или деньги"
        questions={[
          "Что сейчас происходит с моей работой и карьерой?",
          "Что мне мешает чувствовать себя спокойнее с деньгами?",
          "В какую сторону мне двигаться дальше?",
          "Где я беру на себя слишком много?",
        ]}
      />
    </Section>
  );
}

/* ============================================================
   7. Сильные стороны
   ============================================================ */

const STRENGTHS = [
  {
    title: "Видишь нюансы",
    text: "Ты замечаешь нюансы, которые другие пропускают.",
    detail:
      "В твоей карте есть конфигурация, которая делает внимание точечным. Там, где другие смотрят на ситуацию целиком, ты видишь, что именно сдвинулось — в интонации, в поведении, в воздухе комнаты.",
  },
  {
    title: "Собираешься в нужный момент",
    text: "Ты умеешь собраться, когда ситуация требует ясности.",
    detail:
      "В моменты, когда другие теряются, у тебя включается внутренний штурман. Ты не обязательно чувствуешь себя смелой — ты просто делаешь следующий понятный шаг. И этого почти всегда хватает.",
  },
  {
    title: "Чувствуешь фальшь",
    text: "Ты чувствуешь фальшь раньше, чем можешь её объяснить.",
    detail:
      "Это работает на уровне ощущения — раньше, чем слова успевают сложиться. Тебе стоит доверять этому сигналу, даже если внешне «всё в порядке».",
  },
  {
    title: "Поддерживаешь без слов",
    text: "Ты способна поддерживать других без лишних слов.",
    detail:
      "Иногда твоё присутствие важнее любой реплики. Люди успокаиваются рядом с тобой, даже если разговор идёт о пустяках. Это редкое качество, и оно требует от тебя сил — поэтому замечай, сколько ты отдаёшь.",
  },
  {
    title: "Наводишь порядок",
    text: "Ты хорошо видишь, где нужно навести порядок.",
    detail:
      "Хаос в делах, в комнате, в отношениях ты замечаешь быстрее других. И умеешь не просто разложить по полкам, а нащупать причину, из-за которой всё рассыпалось.",
  },
  {
    title: "Ищешь настоящий смысл",
    text: "Ты не любишь поверхностность и ищешь настоящий смысл.",
    detail:
      "Тебе скучно от пустых разговоров и тяжело имитировать энтузиазм. Ты выбираешь людей, дела и темы по одному признаку — настоящее ли это.",
  },
];

function StrengthCard({ s, i }: { s: (typeof STRENGTHS)[number]; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-5%" }}
      transition={{ delay: (i % 3) * 0.05, duration: 0.4 }}
      className="border border-border rounded-sm"
    >
      <button
        onClick={() => {
          haptic("light");
          setOpen((v) => !v);
        }}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          <span className="font-serif text-[15px] text-muted-foreground tabular-nums w-6 shrink-0">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-medium mb-1">{s.title}</div>
            <div className="text-[13px] leading-[1.55] text-foreground/80">{s.text}</div>
          </div>
          <ChevronDown
            className={`h-4 w-4 mt-1 text-muted-foreground shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-secondary/30"
          >
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                Как эта сила проявляется в твоей карте
              </p>
              <p className="text-[13px] leading-[1.65] text-foreground/85">{s.detail}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StrengthsSection() {
  return (
    <Section>
      <Kicker>Твои сильные стороны</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">На что ты можешь опираться</h3>
      <div className="grid grid-cols-1 gap-2">
        {STRENGTHS.map((s, i) => (
          <StrengthCard key={s.title} s={s} i={i} />
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   8. Повторяющиеся сценарии
   ============================================================ */

const PATTERNS = [
  {
    title: "Сначала терпеть, потом резко отдаляться",
    body: [
      "Ты можешь долго делать вид, что всё нормально, объяснять себе поведение другого человека и не говорить о раздражении. Но когда внутренний лимит заканчивается, ты уходишь резко — эмоционально или физически.",
      "Другой человек может даже не понять, где именно потерял с тобой контакт. Тебе важно учиться говорить о маленьком неудобстве раньше, пока оно ещё не стало окончательным решением внутри.",
    ],
    try: "Назвать раздражение раньше, чем оно станет холодностью.",
    question: "Где я слишком долго молчу, прежде чем уйти?",
  },
  {
    title: "Искать контроль там, где нужна опора",
    body: [
      "Когда внутри неспокойно, может появляться желание всё проверить, уточнить, переписать, пересчитать или заранее просчитать чужую реакцию. Это даёт краткое облегчение, но не всегда возвращает настоящую уверенность.",
      "Тебе помогает не тотальный контроль, а понятная опора: честный разговор, ясный план, один следующий шаг.",
    ],
    try: "Не искать все ответы сразу. Найти один шаг, который можно сделать сейчас.",
    question: "Где я держу контроль вместо того, чтобы просить опоры?",
  },
  {
    title: "Быть сильной дольше, чем нужно",
    body: [
      "Ты можешь не сразу показывать усталость, потому что привыкла справляться. Но если слишком долго быть собранной, внутри накапливается напряжение, которое потом выходит резче, чем хотелось бы.",
      "Твоя задача — замечать усталость раньше, а не только тогда, когда уже нет сил объяснять, что происходит.",
    ],
    try: "Остановиться не тогда, когда всё разваливается, а когда впервые становится тяжело.",
    question: "Где я держусь дольше, чем мне на самом деле нужно?",
  },
];

function PatternBlock({ p, i }: { p: (typeof PATTERNS)[number]; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ delay: i * 0.08, duration: 0.5 }}
      className="border border-border rounded-sm p-5"
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
        Сценарий {String(i + 1).padStart(2, "0")}
      </div>
      <h4 className="font-serif text-[19px] leading-tight mb-4">{p.title}</h4>
      <div className="space-y-4">
        {p.body.map((t, idx) => (
          <P key={idx}>{t}</P>
        ))}
      </div>
      <div className="mt-5 pl-4 border-l border-foreground/40">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1.5">Что попробовать</p>
        <p className="font-serif italic text-[15px] leading-[1.55] text-foreground/90">{p.try}</p>
      </div>
      <AskButtons label="Задать вопрос по сценарию" questions={[p.question]} />
    </motion.div>
  );
}

function PatternsSection() {
  return (
    <Section>
      <Kicker>Повторяющиеся сценарии</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-3">Три сюжета, которые ты уже узнаёшь</h3>
      <p className="text-[14px] leading-[1.7] text-muted-foreground mb-6">
        У каждого внутри несколько «коротких метров», которые крутятся снова и снова. Вот три, которые в твоей
        карте звучат громче других.
      </p>
      <div className="space-y-4">
        {PATTERNS.map((p, i) => (
          <PatternBlock key={p.title} p={p} i={i} />
        ))}
      </div>
    </Section>
  );
}

/* ============================================================
   9. Что тебе важно помнить
   ============================================================ */

function RememberSection() {
  const navigate = useNavigate();
  return (
    <Section>
      <Kicker>Что тебе важно помнить</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-5">Главное, что стоит унести с собой</h3>
      <div className="space-y-5">
        <P>
          Тебе не нужно становиться проще, чтобы быть понятной. Но тебе важно учиться говорить о себе раньше,
          чем усталость превращается в холодность.
        </P>
        <P>
          Твоя карта не про идеальность, а про тонкую настройку: где ты слишком сильно держишь контроль, где
          недооцениваешь свою чувствительность и где уже давно готова выбрать себя спокойнее.
        </P>
        <P>
          В тебе есть способность видеть глубже, чем кажется снаружи. Главное — не использовать эту глубину
          против себя.
        </P>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => {
            haptic("light");
            navigate("/compatibility");
          }}
          className="text-[11px] uppercase tracking-[0.25em] px-4 py-2 rounded-full border border-border text-foreground hover:border-foreground/60 transition-colors"
        >
          Посмотреть совместимость
        </button>
        <button
          onClick={() => {
            haptic("light");
            navigate("/");
          }}
          className="text-[11px] uppercase tracking-[0.25em] px-4 py-2 rounded-full border border-border text-foreground hover:border-foreground/60 transition-colors"
        >
          Открыть ежедневный совет
        </button>
      </div>
    </Section>
  );
}

/* ============================================================
   10. Задать вопрос по своей карте
   ============================================================ */

function AskChartSection() {
  return (
    <Section>
      <Kicker>Задать вопрос по своей карте</Kicker>
      <h3 className="font-serif text-[24px] leading-[1.2] mb-3">Звездник ответит с учётом твоей карты</h3>
      <p className="text-[14px] leading-[1.7] text-muted-foreground mb-2">
        Выбери готовый вопрос или задай свой. Ответ будет построен из трёх частей: короткий вывод, почему это
        может быть про тебя, и на что обратить внимание сейчас.
      </p>
      <AskButtons
        label="Открыть готовые вопросы"
        questions={[
          "Что мне важно понять о себе сейчас?",
          "Почему я так реагирую в отношениях?",
          "Где я слишком сильно себя контролирую?",
          "Что мешает мне чувствовать опору?",
          "Какой мой главный повторяющийся сценарий?",
          "Что мне важно принять в себе?",
        ]}
      />
    </Section>
  );
}

/* (OverallFeedback и PaidTransition удалены) */

/* ============================================================
   Outro
   ============================================================ */

function Outro() {
  const navigate = useNavigate();
  const longreads = [
    "Твоя формула близости",
    "Деньги и твоя карта",
    "Путь уверенности",
    "Карьерный потолок",
    "Внутренний ресурс",
    "Карта другого человека и ваша совместимость",
  ];
  return (
    <Section>
      <div className="text-center py-6">
        <div className="text-[36px] mb-4">✦</div>
        <p className="font-serif text-[18px] leading-[1.55] max-w-sm mx-auto mb-10">
          Твоя карта — не приговор. Это партитура. Как именно сыграть — всегда остаётся за тобой.
        </p>

        <div className="text-left max-w-md mx-auto">
          <Kicker>Дальше в лонгридах</Kicker>
          <p className="text-[15px] leading-[1.8] text-foreground/90 mb-5">
            В разделе «Лонгриды» ты можешь углубиться в отдельные сферы своей карты — там собраны разборы, которые
            идут дальше этого обзора и подсвечивают конкретные темы по очереди.
          </p>
          <ul className="space-y-2 mb-6">
            {longreads.map((t) => (
              <li
                key={t}
                className="flex items-start gap-2 text-[14px] leading-[1.5] text-foreground/85"
              >
                <ChevronRight className="h-3.5 w-3.5 mt-1 shrink-0 text-muted-foreground" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => {
              haptic("light");
              navigate("/longreads");
            }}
            className="w-full text-[11px] uppercase tracking-[0.25em] px-4 py-3 rounded-full border border-foreground text-foreground hover:bg-foreground hover:text-background transition-colors"
          >
            Открыть лонгриды
          </button>
        </div>
      </div>
    </Section>
  );
}

/* ============================================================
   Main
   ============================================================ */

export function InteractiveNatalChart(_props: { birthDate?: string | null; name?: string | null }) {
  return (
    <div className="relative">
      <HeroBlock />
      <MainAboutYou />
      <ThreeEnergies />
      <StressSection />
      <RelationshipsSection />
      <WorkMoneySection />
      <StrengthsSection />
      <PatternsSection />
      <RememberSection />
      <AskChartSection />
      <Outro />
    </div>
  );
}
