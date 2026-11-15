// Inside the Data Model — page behavior.
// Phase 4: navigation only (active section, progress bar, keyboard shortcuts).
// Each interactive demo will be added in its own block below.

(() => {
  "use strict";

  const SECTION_IDS = ["overview", "classes", "lifecycle", "streaming", "design", "conclusion"];
  const navLinks = new Map(
    SECTION_IDS.map((id) => [id, document.querySelector(`.sections-nav a[href="#${id}"]`)])
  );

  // --- Active section in the top navigation -------------------------------
  const nav = document.querySelector(".sections-nav");

  // Scroll only the nav bar horizontally; scrollIntoView() could also move the page.
  function revealInNav(link) {
    if (!nav) return;
    const n = nav.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    if (l.left < n.left) nav.scrollLeft -= n.left - l.left + 8;
    else if (l.right > n.right) nav.scrollLeft += l.right - n.right + 8;
  }

  let currentSection = null;

  function setActive(id) {
    currentSection = id;
    for (const [key, link] of navLinks) {
      if (!link) continue;
      if (key === id) {
        link.setAttribute("aria-current", "true");
        revealInNav(link);
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length) setActive(visible[0].target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // --- Reading progress bar -----------------------------------------------
  const bar = document.getElementById("progress-bar");
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? window.scrollY / max : 0;
    bar.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
  updateProgress();

  // =========================================================================
  // §1 — Architecture diagram
  // Every type and line reference below was checked against commit 5e931ff3.
  // =========================================================================

  const SRC = "https://github.com/rrobbes/mistral-vibe/blob/5e931ff306602964a7abbabb7d3026dd76c71e31/";
  const code = (path, lines, label) => ({ label: label || `${path.split("/").pop()}${lines ? ":" + lines.replace("-", "–") : ""}`, url: `${SRC}${path}${lines ? "#L" + lines.replace("-", "-L") : ""}` });

  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const linkList = (links) =>
    `<p class="panel__label">Dans le code</p><ul class="panel__links">${links
      .map((l) => `<li><a href="${l.url}"${l.url.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(l.label)}</a></li>`)
      .join("")}</ul>`;

  // family: msg | stream | event | session | stats | public (not from types.py)
  const FLOWS = {
    "ui-app": {
      title: "Interface → App Server", label: "requêtes", color: "public", nodes: ["ui", "app"],
      text: "L'interface envoie des requêtes au protocole de l'App Server : démarrer un tour avec le prompt, répondre à une demande d'approbation…",
      types: [
        ["TurnStartParams", "public", "démarre un tour à partir du texte saisi"],
        ["CallbackRespondParams", "public", "répond à une demande (approbation, question)"],
      ],
      note: "Ces modèles appartiennent au protocole de l'App Server, pas à types.py.",
      links: [code("vibe/app_server/protocol.py", "2191"), code("vibe/app_server/protocol.py", "2260")],
    },
    "app-ui": {
      title: "App Server → Interface", label: "événements publics", color: "public", nodes: ["app", "ui"],
      text: "L'App Server projette les événements du moteur en mises à jour publiques. L'interface ne voit jamais les objets de types.py.",
      types: [
        ["HistoryEntryAdded", "public", "une entrée apparaît dans l'historique"],
        ["CallbackRequested", "public", "l'interface doit répondre (ex. approbation)"],
        ["PublicSession", "public", "état public, « allégé », de la session"],
      ],
      note: "Vérifié : aucun fichier de vibe/cli, vibe/acp ou vibe/cli-rust n'importe vibe.core.types.",
      links: [code("vibe/app_server/_projector.py", "89", "EventProjector"), code("vibe/app_server/events.py", "45"), code("vibe/app_server/models.py", "1202")],
    },
    "app-loop": {
      title: "App Server → Agent Loop", label: "prompt · réponses", color: "msg", nodes: ["app", "loop"],
      text: "L'App Server lance un tour avec act(), puis transmet les réponses aux demandes d'approbation.",
      types: [
        ["str", "public", "le texte du prompt (paramètre msg)"],
        ["ImageAttachment", "msg", "images jointes au prompt"],
        ["ApprovalResponse", "event", "« y » ou « n » en réponse à une approbation"],
      ],
      links: [code("vibe/core/agent_loop/_loop.py", "1676-1689", "AgentLoop.act()"), code("vibe/core/agent_loop/_loop.py", "1147-1150", "resolve_approval_request()")],
    },
    "loop-app": {
      title: "Agent Loop → App Server", label: "événements", color: "event", nodes: ["loop", "app"],
      text: "act() est un générateur asynchrone : il produit un flux d'événements typés, et c'est le seul canal vers l'extérieur (ADR 0003). Les erreurs du fournisseur remontent comme exceptions.",
      types: [
        ["BaseEvent", "event", "type de retour : AsyncGenerator[BaseEvent]"],
        ["AssistantEvent", "event", "un morceau de texte de la réponse"],
        ["ToolCallEvent / ToolResultEvent", "event", "début et fin d'un appel d'outil"],
        ["ApprovalRequestEvent", "event", "l'utilisateur doit approuver un outil"],
        ["RateLimitError, RefusalError…", "event", "erreurs typées levées par la boucle"],
      ],
      links: [code("vibe/core/agent_loop/_loop.py", "1689", "-> AsyncGenerator[BaseEvent]"), code("vibe/core/types.py", "522-663", "événements dans types.py")],
    },
    "loop-llm": {
      title: "Agent Loop → Backend LLM", label: "messages · outils", color: "msg", nodes: ["loop", "llm"],
      text: "La boucle envoie toute la conversation et la description des outils disponibles.",
      types: [
        ["Sequence[LLMMessage]", "msg", "l'historique (système, utilisateur, assistant, outils)"],
        ["list[AvailableTool]", "msg", "le schéma JSON de chaque outil"],
        ["StrToolChoice", "msg", "\"auto\", \"none\", \"any\" ou \"required\""],
      ],
      links: [code("vibe/core/llm/backend/generic.py", "477-488", "complete_streaming()"), code("vibe/core/types.py", "227-238")],
    },
    "llm-loop": {
      title: "Backend LLM → Agent Loop", label: "chunks", color: "stream", nodes: ["llm", "loop"],
      text: "Chaque backend traduit le format de son fournisseur en LLMChunk, puis les envoie un par un. La boucle les additionne avec + (voir le Streaming Lab).",
      types: [
        ["LLMChunk", "stream", "un fragment de réponse (figé)"],
        ["LLMMessage", "msg", "le contenu du fragment, dans chunk.message"],
        ["LLMUsage", "stats", "tokens consommés, souvent dans le dernier chunk"],
        ["StopInfo", "stream", "pourquoi le flux s'arrête (ex. refus)"],
      ],
      links: [code("vibe/core/llm/backend/generic.py", "488", "-> AsyncGenerator[LLMChunk]"), code("vibe/core/agent_loop/_loop.py", "3394-3398", "chunk_agg + chunk")],
    },
    "loop-disk": {
      title: "Agent Loop → fichiers de session", label: "transcription", color: "session", nodes: ["loop", "disk"],
      text: "La boucle possède un SessionLogger, qui écrit chaque message en JSON et les métadonnées de la session. C'est ce qui permet de reprendre une session.",
      types: [
        ["LLMMessage", "msg", "écrit avec model_dump(exclude_none=True, mode=\"json\")"],
        ["SessionMetadata", "session", "titre, git, environnement, sous-sessions…"],
      ],
      links: [code("vibe/core/agent_loop/_loop.py", "742", "SessionLogger(…)"), code("vibe/core/session/session_logger.py", "442")],
    },
  };

  const NODES = {
    ui: {
      title: "Interface", kicker: "vibe/cli · vibe/cli-rust · vibe/acp", color: "public",
      text: "Le terminal (Textual, puis Ratatui) et les éditeurs via le protocole ACP. Les interfaces n'affichent que ce que l'App Server leur envoie.",
      facts: ["0 fichier importe vibe.core.types : la frontière de l'ADR 0002 est respectée."],
      links: [code("docs/adr/0002-core-engine-and-delivery-surfaces.md", "", "ADR 0002")],
    },
    app: {
      title: "App Server", kicker: "vibe/app_server", color: "event",
      text: "Le point d'assemblage entre le moteur et les interfaces : il possède les sessions, transmet les approbations et convertit les événements du moteur en événements publics.",
      facts: ["EventProjector distingue les événements de types.py avec un match ; ceux qu'il ne traite pas tombent dans case _."],
      links: [code("vibe/app_server/_projector.py", "89", "EventProjector"), code("vibe/app_server/_turns.py", "476", "answer_callback()")],
    },
    loop: {
      title: "Agent Loop (moteur Python)", kicker: "vibe/core/agent_loop/_loop.py", color: "msg",
      text: "Le chef d'orchestre du moteur Python : appelle le modèle, exécute les outils, émet les événements. C'est le plus gros utilisateur de types.py.",
      facts: [
        "Possède la MessageList (l'historique), AgentStats (les compteurs) et le SessionLogger.",
        "Depuis cette version, ce moteur n'est utilisé qu'avec vibe --legacy-harness : le Unified Harness est le moteur par défaut.",
      ],
      links: [code("vibe/core/agent_loop/_loop.py", "1676", "AgentLoop.act()"), code("vibe/_experimental_harness.py", "123-137", "choix du moteur")],
    },
    llm: {
      title: "Backend LLM", kicker: "vibe/core/llm/backend/", color: "stream",
      text: "Un adaptateur par famille de fournisseurs (mistral, generic, anthropic, openai_responses). Chacun produit des LLMChunk, quel que soit le format de l'API.",
      facts: ["Sujet documenté par Alexis : core/backend/."],
      links: [code("vibe/core/llm/backend/mistral.py", "545", "mistral.py"), code("vibe/core/llm/backend/generic.py", "477", "generic.py")],
    },
    disk: {
      title: "Fichiers de session", kicker: "vibe/core/session/", color: "session",
      text: "Transcription JSON des messages et métadonnées de la session. Les anciens formats restent lisibles grâce aux validateurs de types.py (migration « paresseuse »).",
      facts: ["Exemple : ImageAttachment._migrate_flat_source convertit l'ancien format d'image à la lecture."],
      links: [code("vibe/core/session/session_logger.py", "446", "save_interaction()"), code("vibe/core/types.py", "307-318", "_migrate_flat_source")],
    },
    types: {
      title: "vibe/core/types.py", kicker: "le socle commun", color: "msg",
      text: "Les objets partagés par tout le moteur, surtout des modèles Pydantic : messages, chunks, événements, sessions, statistiques, erreurs.",
      facts: ["Importé par 84 fichiers du moteur et 144 fichiers de tests.", "Ne dépend d'aucune interface : il n'importe que quelques modules du moteur, vibe/user_content et vibe/utils."],
      links: [code("vibe/core/types.py", "", "types.py sur GitHub"), { label: "Rapport §2", url: "types.md#2-where-the-module-sits-in-the-architecture" }],
    },
  };

  const FAMILIES = {
    msg: { title: "Messages", flows: ["app-loop", "loop-llm", "llm-loop", "loop-disk"], nodes: ["loop"],
      text: "Les messages vont et viennent entre la boucle et le backend, et sont écrits sur disque. La MessageList qui les contient vit dans l'Agent Loop." },
    event: { title: "Événements", flows: ["loop-app"], nodes: ["app"],
      text: "Les événements ne prennent qu'un chemin : de la boucle vers l'App Server, qui les traduit pour l'interface." },
    session: { title: "Sessions", flows: ["loop-disk"], nodes: ["disk"],
      text: "SessionMetadata et la transcription des messages sont écrits par le SessionLogger de la boucle." },
    stats: { title: "Statistiques", flows: ["llm-loop"], nodes: ["loop"],
      text: "LLMUsage arrive avec les chunks ; la boucle le cumule dans AgentStats (tokens, coût, appels d'outils)." },
  };

  const svg = document.querySelector(".arch__svg");
  const panel = document.getElementById("arch-panel");
  const familyButtons = [...document.querySelectorAll(".family[data-family]")];

  if (svg && panel) {
    const flowEls = [...svg.querySelectorAll(".flow[data-flow]")];
    const nodeEls = [...svg.querySelectorAll(".node[data-node]")];
    const COLORS = { msg: "var(--msg)", stream: "var(--stream)", event: "var(--event)", session: "var(--session)", stats: "var(--stats)", public: "#8792ad" };
    let pinned = null; // { kind, id } or null

    function renderDefault() {
      panel.style.setProperty("--pc", "var(--border-strong)");
      panel.innerHTML = `
        <p class="panel__kicker">mode d'emploi</p>
        <h3>Qui échange quoi&nbsp;?</h3>
        <p>Chaque flèche transporte des objets. En couleur : des types de <code>types.py</code>.
           En gris : des modèles publics propres à l'App Server. Les lignes pointillées indiquent qui importe <code>types.py</code>.</p>`;
    }

    function renderFlow(id) {
      const f = FLOWS[id];
      panel.style.setProperty("--pc", COLORS[f.color]);
      panel.innerHTML = `
        <p class="panel__kicker">flux · ${escapeHtml(f.label)}</p>
        <h3>${escapeHtml(f.title)}</h3>
        <div class="panel__grid">
          <div>
            <p>${escapeHtml(f.text)}</p>
            <ul class="panel__types">${f.types
              .map(([name, fam, desc]) => `<li><code class="t--${fam}">${escapeHtml(name)}</code>${escapeHtml(desc)}</li>`)
              .join("")}</ul>
            ${f.note ? `<p><em>${escapeHtml(f.note)}</em></p>` : ""}
          </div>
          <div>${linkList(f.links)}</div>
        </div>`;
    }

    function renderNode(id) {
      const n = NODES[id];
      panel.style.setProperty("--pc", COLORS[n.color]);
      panel.innerHTML = `
        <p class="panel__kicker">${escapeHtml(n.kicker)}</p>
        <h3>${escapeHtml(n.title)}</h3>
        <div class="panel__grid">
          <div>
            <p>${escapeHtml(n.text)}</p>
            <ul class="panel__types">${n.facts.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
          </div>
          <div>${linkList(n.links)}</div>
        </div>`;
    }

    function renderFamily(id) {
      const fam = FAMILIES[id];
      panel.style.setProperty("--pc", `var(--${id})`);
      panel.innerHTML = `
        <p class="panel__kicker">famille</p>
        <h3>${escapeHtml(fam.title)}</h3>
        <p>${escapeHtml(fam.text)}</p>
        <p class="panel__label">Flux concernés</p>
        <ul class="panel__types">${fam.flows.map((f) => `<li>${escapeHtml(FLOWS[f].title)} · <em>${escapeHtml(FLOWS[f].label)}</em></li>`).join("")}</ul>`;
    }

    function highlight(flows, nodes) {
      svg.classList.toggle("has-focus", flows.length + nodes.length > 0);
      flowEls.forEach((el) => el.classList.toggle("is-active", flows.includes(el.dataset.flow)));
      const related = new Set(flows.flatMap((f) => FLOWS[f].nodes));
      nodeEls.forEach((el) => {
        el.classList.toggle("is-active", nodes.includes(el.dataset.node));
        el.classList.toggle("is-related", related.has(el.dataset.node));
      });
    }

    function show(sel) {
      if (!sel) {
        highlight([], []);
        renderDefault();
      } else if (sel.kind === "flow") {
        highlight([sel.id], []);
        renderFlow(sel.id);
      } else if (sel.kind === "node") {
        const touching = Object.keys(FLOWS).filter((f) => FLOWS[f].nodes.includes(sel.id));
        highlight(sel.id === "types" ? [] : touching, [sel.id]);
        renderNode(sel.id);
      } else if (sel.kind === "family") {
        highlight(FAMILIES[sel.id].flows, FAMILIES[sel.id].nodes);
        renderFamily(sel.id);
      }
      familyButtons.forEach((b) =>
        b.setAttribute("aria-pressed", String(sel?.kind === "family" && sel.id === b.dataset.family))
      );
    }

    const same = (a, b) => a && b && a.kind === b.kind && a.id === b.id;
    function toggle(sel) {
      pinned = same(pinned, sel) ? null : sel;
      show(pinned);
    }

    function bind(el, sel) {
      el.addEventListener("mouseenter", () => show(sel));
      el.addEventListener("mouseleave", () => show(pinned));
      el.addEventListener("click", () => toggle(sel));
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(sel);
        }
      });
    }

    flowEls.forEach((el) => bind(el, { kind: "flow", id: el.dataset.flow }));
    nodeEls.forEach((el) => bind(el, { kind: "node", id: el.dataset.node }));
    familyButtons.forEach((b) => b.addEventListener("click", () => toggle({ kind: "family", id: b.dataset.family })));

    show(null);
  }

  // =========================================================================
  // §2 — UML class diagrams, rendered as SVG from the data below.
  // Fields are copied from vibe/core/types.py at commit 5e931ff3. Fields drawn
  // as relations are not repeated inside the boxes (UML convention).
  // =========================================================================

  const TYPES = "vibe/core/types.py";
  const HEAD_H = 50, ROW_H = 20, PAD = 16;

  const UML = {
    a: {
      intro: "Un message (LLMMessage) peut porter des appels d'outils. Pendant le streaming, il arrive en morceaux dans des LLMChunk. L'historique complet est gardé dans une MessageList.",
      classes: {
        Sequence: { x: 20, y: 20, w: 250, ext: true, stereo: "«externe»", label: "Sequence[LLMMessage]",
          src: { label: "collections.abc.Sequence", url: "https://docs.python.org/3/library/collections.abc.html#collections.abc.Sequence" },
          role: "Classe abstraite de la bibliothèque standard Python : une séquence en lecture (len, [i], itération). MessageList en hérite au lieu d'hériter de list.",
          fields: [] },
        MessageList: { x: 20, y: 110, w: 250, color: "msg", line: "670-745",
          attrs: ["- _reset_hooks : Callable [0..*]", "- _lock : RLock"],
          methods: ["+ append(msg)", "+ reset(new)", "+ reset_preserving_system(tail)", "+ update_system_prompt(new)", "+ on_reset(hook)", "+ __iter__()"],
          role: "L'historique de la conversation. Ce n'est pas une simple liste : un verrou (RLock) protège les opérations qui lisent puis remplacent le contenu, et des « hooks » préviennent par exemple le RewindManager quand l'historique est remplacé.",
          fieldsLabel: "Attributs créés dans __init__ (pas un modèle Pydantic)",
          fields: ["self._data: list[LLMMessage] = list(initial) if initial else []", "self._reset_hooks: list[Callable[[], None]] = []", "self._lock = threading.RLock()"],
          notes: ["update_system_prompt() insère le prompt système en tête s'il n'existe pas encore, sans écraser la case 0."] },
        LLMMessage: { x: 340, y: 20, w: 320, color: "msg", line: "346-469",
          attrs: ["+ role : Role", "+ content : str [0..1]", "+ reasoning_content : str [0..1]", "+ tool_call_id : str [0..1]", "+ message_id : str [0..1]", "+ injected : bool = False", "+ tool_result : PersistedToolResult [0..1]", "+ images : ImageAttachment [0..*]"],
          more: "… 8 autres champs",
          methods: ["+ __add__(other) : LLMMessage", "«before» _from_any(v)"],
          role: "Un message de la conversation : système, utilisateur, assistant ou résultat d'outil. Le validateur _from_any donne un message_id (UUID) à tout message qui n'est pas de rôle tool, et accepte aussi bien un dict qu'un objet venant d'un SDK.",
          fields: ["role: Role", "content: Content | None = None", "images: list[ImageAttachment] | None = None", "injected: bool = False", "reasoning_content: Content | None = None", "reasoning_payloads: list[dict[str, Any]] | None = None", "reasoning_message_id: str | None = None", "tool_calls: list[ToolCall] | None = None", "name: str | None = None", "tool_call_id: str | None = None", "tool_result: PersistedToolResult | None = None", "message_id: str | None = None", "user_display_content: UserDisplayContent | None = None", "input_text: str | None = None", "resources: list[UserResource] | None = None", "manual_shell: ManualShellContext | None = None", 'context_boundary: Literal["compaction"] | None = None'],
          notes: ["Lien par identifiant, non dessiné : un message de rôle tool désigne l'appel auquel il répond par tool_call_id == ToolCall.id."] },
        FunctionCall: { x: 20, y: 440, w: 250, color: "msg", line: "241-243",
          attrs: ["+ name : str [0..1]", "+ arguments : str [0..1]"],
          role: "Le nom de l'outil et ses arguments, sous forme de chaîne JSON. Pendant le streaming, cette chaîne est incomplète jusqu'au dernier fragment.",
          fields: ["name: str | None = None", "arguments: str | None = None"] },
        ToolCall: { x: 340, y: 420, w: 320, color: "msg", line: "246-251",
          attrs: ["+ id : str [0..1]", "+ index : int [0..1]", '+ type : "function"', "+ presentation : ToolCallPresentation [0..1]"],
          role: "Un appel d'outil demandé par le modèle. L'index sert à regrouper les fragments d'un même appel pendant le streaming ; l'id relie l'appel à son résultat.",
          fields: ["id: str | None = None", "index: int | None = None", "function: FunctionCall = Field(default_factory=FunctionCall)", 'type: Literal["function"] = "function"', "presentation: ToolCallPresentation | None = None"] },
        LLMChunk: { x: 720, y: 20, w: 260, color: "stream", stereo: "«frozen»", line: "502-519",
          attrs: ["+ correlation_id : str [0..1]", "+ stop : StopInfo [0..1]"],
          methods: ["+ __add__(other) : LLMChunk"],
          role: "Un fragment de réponse envoyé par un backend. Les fragments s'additionnent : les messages sont fusionnés, l'usage est sommé, et stop / correlation_id viennent du fragment le plus récent (opérande de droite).",
          fields: ["message: LLMMessage", "usage: LLMUsage | None = None", "correlation_id: str | None = None", "stop: StopInfo | None = None"],
          notes: ["frozen=True est superficiel : le LLMMessage contenu reste modifiable."] },
        LLMUsage: { x: 720, y: 300, w: 260, color: "stats", stereo: "«frozen»", line: "472-484",
          attrs: ["+ prompt_tokens : int = 0", "+ completion_tokens : int = 0", "+ cached_tokens : int = 0"],
          methods: ["+ __add__(other) : LLMUsage"],
          role: "Le nombre de tokens d'un appel. Une valeur immuable qu'on additionne champ par champ ; cached_tokens est une partie de prompt_tokens.",
          fields: ["prompt_tokens: int = 0", "completion_tokens: int = 0", "cached_tokens: int = 0"] },
      },
      rels: [
        { kind: "inherit", from: "MessageList", to: "Sequence", pts: [[145, 110], [145, 70]] },
        { kind: "aggregate", from: "MessageList", to: "LLMMessage", pts: [[270, 190], [340, 190]], role: ["_data", 305, 182, "middle"], mult: ["0..*", 322, 206, "middle"] },
        { kind: "compose", from: "LLMChunk", to: "LLMMessage", pts: [[720, 90], [660, 90]], role: ["message", 690, 82, "middle"], mult: ["1", 668, 106, "middle"] },
        { kind: "compose", from: "LLMChunk", to: "LLMUsage", pts: [[850, 162], [850, 300]], role: ["usage", 858, 250, "start"], mult: ["0..1", 858, 290, "start"] },
        { kind: "compose", from: "LLMMessage", to: "ToolCall", pts: [[500, 322], [500, 420]], role: ["tool_calls", 508, 380, "start"], mult: ["0..*", 508, 412, "start"] },
        { kind: "compose", from: "ToolCall", to: "FunctionCall", pts: [[340, 493], [270, 493]], role: ["function", 305, 485, "middle"], mult: ["1", 278, 509, "middle"] },
      ],
    },
    b: {
      intro: "Toutes les communications de la boucle d'agent vers l'App Server passent par des sous-classes de BaseEvent. Cinq d'entre elles sont détaillées ici ; les quatorze autres suivent le même principe.",
      note: { x: 15, y: 20, w: 330, h: 86, anchor: [[300, 106], [300, 180]],
        lines: ["ToolCallEvent, ToolResultEvent et", "ApprovalRequestEvent partagent le même", "tool_call_id : il relie leurs événements."] },
      classes: {
        BaseEvent: { x: 380, y: 20, w: 240, color: "event", stereo: "«ABC»", abstract: true, line: "522-523",
          attrs: ["(aucun champ propre)"],
          role: "La racine de tous les événements. Elle hérite de ABC mais ne déclare aucune méthode abstraite : elle est abstraite par intention, pas techniquement. Elle autorise des types arbitraires (arbitrary_types_allowed), nécessaires pour tool_class.",
          fields: ["model_config = ConfigDict(arbitrary_types_allowed=True)"] },
        Others: { x: 680, y: 20, w: 300, ext: true, stereo: "«résumé»", label: "14 autres sous-classes",
          attrs: ["UserMessageEvent, ReasoningEvent,", "ToolStreamEvent, CompactStartEvent,", "… (cliquer pour la liste)"],
          src: { label: "types.py, lignes 526-662", url: `${SRC}${TYPES}#L526-L662` },
          role: "Les autres événements, non dessinés pour garder le diagramme lisible. UserInputRequestEvent hérite de RequestEvent, comme ApprovalRequestEvent ; tous les autres héritent directement de BaseEvent.",
          fields: ["UserMessageEvent", "ReasoningEvent", "ToolStreamEvent", "WaitingForInputEvent", "UserInputRequestEvent (← RequestEvent)", "TokenUsageUpdatedEvent", "CompactStartEvent", "CompactEndEvent", "PlanReviewRequestedEvent", "PlanReviewEndedEvent", "AgentProfileChangedEvent", "ContextClearedEvent", "SessionTitleUpdatedEvent", "BackgroundWorkEvent"] },
        AssistantEvent: { x: 15, y: 180, w: 235, color: "event", line: "534-545",
          attrs: ["+ content : str", "+ stopped_by_middleware : bool", "+ message_id : str [0..1]"],
          methods: ["+ __add__(o) : AssistantEvent"],
          role: "Un morceau de texte de la réponse de l'assistant, émis au fil du streaming. Il s'additionne lui aussi avec +.",
          fields: ["content: str", "stopped_by_middleware: bool = False", "message_id: str | None = None"] },
        ToolCallEvent: { x: 265, y: 180, w: 235, color: "event", line: "553-559", key: "tool_call_id",
          attrs: ["+ tool_call_id : str", "+ tool_name : str", "+ tool_call_index : int [0..1]", "+ args : BaseModel [0..1]", "+ presentation : … [0..1]"],
          role: "Le modèle a demandé un outil. En mode streaming, il est émis deux fois : dès que l'id et le nom sont connus (sans args), puis avec les arguments validés.",
          notes: ["Émissions : _loop.py:2589 (pendant le streaming) et _loop.py:2649 (avant l'exécution)."],
          fields: ["tool_call_id: str", "tool_name: str", "tool_class: type[BaseTool]", "tool_call_index: int | None = None", "args: BaseModel | None = None", "presentation: ToolCallPresentation | None = None"] },
        ToolResultEvent: { x: 515, y: 180, w: 255, color: "event", line: "562-576", key: "tool_call_id",
          attrs: ["+ tool_call_id : str", "+ tool_name : str", "+ result : BaseModel [0..1]", "+ error : str [0..1]", "+ cancelled : bool", "+ decision : Literal [0..1]", "+ approval_source : Literal [0..1]"],
          more: "… 6 autres champs",
          role: "Un outil a terminé : succès, erreur, saut ou annulation. Il enregistre aussi comment l'appel a été autorisé (approval_source : config, smart, user, bypass ou never).",
          fields: ["tool_name: str", "tool_class: type[BaseTool] | None", "result: BaseModel | None = None", "error: str | None = None", "error_display: str | None = None", "skipped: bool = False", "skip_reason: str | None = None", "cancelled: bool = False", "duration: float | None = None", "tool_call_id: str", "presentation: ToolResultPresentation | None = None", 'decision: Literal["execute", "skip"] | None = None', 'approval_type: Literal["always", "never", "ask"] | None = None', 'approval_source: Literal["config", "smart", "user", "bypass", "never"] | None = None'] },
        RequestEvent: { x: 780, y: 180, w: 205, color: "event", line: "591-592",
          attrs: ["+ request_id : str"],
          role: "Un événement qui attend une réponse. L'App Server répond en rappelant request_id ; la boucle reste en attente sur un asyncio.Future d'ici là.",
          fields: ["request_id: str"] },
        ApprovalRequestEvent: { x: 780, y: 320, w: 205, color: "event", line: "595-599", key: "tool_call_id",
          attrs: ["+ tool_name : str", "+ tool_args : BaseModel", "+ tool_call_id : str"],
          role: "L'utilisateur doit autoriser un appel d'outil. Il n'est émis que si la permission vaut « ask » et que les permissions requises ne sont pas déjà accordées.",
          fields: ["request_id: str  (hérité)", "tool_name: str", "tool_args: BaseModel", "tool_call_id: str", "required_permissions: list[RequiredPermission] | None = None"] },
        BaseTool: { x: 395, y: 470, w: 210, ext: true, stereo: "«externe»", label: "BaseTool",
          src: { label: "tools/base.py", url: `${SRC}vibe/core/tools/base.py` },
          role: "La classe de base des outils, hors de types.py. types.py ne l'importe que sous TYPE_CHECKING : à l'exécution, BaseTool vaut Any, ce qui évite un import circulaire.",
          fields: [] },
        RequiredPermission: { x: 780, y: 510, w: 205, ext: true, stereo: "«externe»", label: "RequiredPermission",
          src: { label: "vibe/permissions.py:38", url: `${SRC}vibe/permissions.py#L38` },
          role: "Une permission que l'appel d'outil nécessite. Modèle Pydantic défini dans vibe/permissions.py.",
          fields: [] },
      },
      rels: [
        { kind: "inherit", from: "Others", to: "BaseEvent", pts: [[680, 63], [620, 63]] },
        { kind: "inherit", from: "AssistantEvent", to: "BaseEvent", pts: [[132, 180], [132, 150], [500, 150], [500, 106]] },
        { kind: "inherit", from: "ToolCallEvent", to: "BaseEvent", pts: [[382, 180], [382, 150], [500, 150], [500, 106]] },
        { kind: "inherit", from: "ToolResultEvent", to: "BaseEvent", pts: [[642, 180], [642, 150], [500, 150], [500, 106]] },
        { kind: "inherit", from: "RequestEvent", to: "BaseEvent", pts: [[882, 180], [882, 150], [500, 150], [500, 106]] },
        { kind: "inherit", from: "ApprovalRequestEvent", to: "RequestEvent", pts: [[882, 320], [882, 266]] },
        { kind: "depend", from: "ToolCallEvent", to: "BaseTool", pts: [[440, 346], [440, 470]], role: ["tool_class", 448, 410, "start"] },
        { kind: "depend", from: "ToolResultEvent", to: "BaseTool", pts: [[560, 406], [560, 470]], role: ["tool_class", 568, 440, "start"] },
        { kind: "compose", from: "ApprovalRequestEvent", to: "RequiredPermission", pts: [[882, 446], [882, 510]], role: ["required_permissions", 874, 478, "end"], mult: ["0..*", 874, 500, "end"] },
      ],
    },
  };

  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent, text) {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text != null) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function drawClass(svg, name, c) {
    const attrs = c.attrs || [];
    const rows = attrs.length + (c.more ? 1 : 0);
    const methods = c.methods || [];
    const attrH = rows ? rows * ROW_H + PAD : 0;
    const methH = methods.length ? methods.length * ROW_H + PAD : 0;
    const h = HEAD_H + attrH + methH;
    const cls = c.ext ? "ext" : c.color;

    const g = el("g", { class: `cls cls--${cls}`, "data-cls": name, tabindex: "0", role: "button", "aria-label": `Classe ${c.label || name}` }, svg);
    el("rect", { class: "cls__box", x: c.x, y: c.y, width: c.w, height: h, rx: 6 }, g);
    el("rect", { class: "cls__head", x: c.x + 1, y: c.y + 1, width: c.w - 2, height: HEAD_H - 1, rx: 5 }, g);
    const cx = c.x + c.w / 2;
    if (c.stereo) el("text", { class: "cls__stereo", x: cx, y: c.y + 18 }, g, c.stereo);
    el("text", { class: `cls__name${c.abstract ? " cls__name--abstract" : ""}`, x: cx, y: c.y + (c.stereo ? 39 : 31) }, g, c.label || name);

    let y = c.y + HEAD_H;
    if (rows) {
      el("line", { class: "cls__sep", x1: c.x, y1: y, x2: c.x + c.w, y2: y }, g);
      attrs.forEach((a, i) => {
        const isKey = c.key && a.includes(c.key);
        el("text", { class: `cls__row${isKey ? " cls__row--key" : ""}`, x: c.x + 12, y: y + 8 + (i + 1) * ROW_H - 5 }, g, a);
      });
      if (c.more) el("text", { class: "cls__row cls__row--more", x: c.x + 12, y: y + 8 + rows * ROW_H - 5 }, g, c.more);
      y += attrH;
    }
    if (methods.length) {
      el("line", { class: "cls__sep", x1: c.x, y1: y, x2: c.x + c.w, y2: y }, g);
      methods.forEach((m, i) => el("text", { class: "cls__row", x: c.x + 12, y: y + 8 + (i + 1) * ROW_H - 5 }, g, m));
    }
    return g;
  }

  function drawRel(svg, r, i) {
    const g = el("g", { class: "rel-g", "data-rel": i }, svg);
    const pts = r.pts.map((p) => [...p]);
    const [a, b] = r.kind === "inherit" || r.kind === "depend" ? [pts[pts.length - 2], pts[pts.length - 1]] : [pts[1], pts[0]];
    // unit vector pointing toward the decorated end
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const tip = b;

    if (r.kind === "inherit") {
      const base = [tip[0] - ux * 14, tip[1] - uy * 14];
      pts[pts.length - 1] = base;
      el("polyline", { class: "rel", points: pts.map((p) => p.join(",")).join(" ") }, g);
      el("path", { class: "rel rel__head--hollow", d: `M${tip} L${base[0] + nx * 8},${base[1] + ny * 8} L${base[0] - nx * 8},${base[1] - ny * 8}Z` }, g);
    } else if (r.kind === "depend") {
      el("polyline", { class: "rel rel--dep", points: pts.map((p) => p.join(",")).join(" ") }, g);
      const back = [tip[0] - ux * 11, tip[1] - uy * 11];
      el("path", { class: "rel", d: `M${back[0] + nx * 6},${back[1] + ny * 6} L${tip} L${back[0] - nx * 6},${back[1] - ny * 6}` }, g);
    } else {
      // diamond sits on the "whole" end, which is pts[0]
      const mid = [tip[0] - ux * 12, tip[1] - uy * 12], end = [tip[0] - ux * 24, tip[1] - uy * 24];
      pts[0] = end;
      el("polyline", { class: "rel", points: pts.map((p) => p.join(",")).join(" ") }, g);
      el("path", {
        class: `rel ${r.kind === "compose" ? "rel__head--filled" : "rel__head--hollow"}`,
        d: `M${tip} L${mid[0] + nx * 6},${mid[1] + ny * 6} L${end} L${mid[0] - nx * 6},${mid[1] - ny * 6}Z`,
      }, g);
    }
    for (const lab of [r.role, r.mult]) {
      if (lab) el("text", { class: "rel__label", x: lab[1], y: lab[2], "text-anchor": lab[3] }, g, lab[0]);
    }
    return g;
  }

  function drawNote(svg, n) {
    const g = el("g", { class: "uml-note", "aria-hidden": "true" }, svg);
    const f = 14;
    el("path", { class: "uml-note__box", d: `M${n.x},${n.y} h${n.w - f} l${f},${f} v${n.h - f} h${-n.w} Z M${n.x + n.w - f},${n.y} v${f} h${f}` }, g);
    n.lines.forEach((l, i) => el("text", { class: "uml-note__text", x: n.x + 14, y: n.y + 28 + i * 20 }, g, l));
    el("polyline", { class: "rel rel--dep", points: n.anchor.map((p) => p.join(",")).join(" ") }, g);
  }

  const REL_TEXT = {
    inherit: { from: (o) => `△ hérite de ${o}`, to: (o) => `△ spécialisée par ${o}` },
    compose: { from: (o, r) => `◆ composée de ${o}${r}`, to: (o, r) => `◆ fait partie de ${o}${r}` },
    aggregate: { from: (o, r) => `◇ regroupe des ${o}${r}`, to: (o, r) => `◇ regroupée dans ${o}${r}` },
    depend: { from: (o, r) => `⇢ dépend de ${o}${r}`, to: (o, r) => `⇢ référencée par ${o}${r}` },
  };

  const umlPanel = document.getElementById("uml-panel");
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];

  if (umlPanel && tabs.length) {
    const views = {};
    for (const key of ["a", "b"]) {
      const svgEl = document.getElementById(`uml-${key}`);
      const spec = UML[key];
      const relGroups = spec.rels.map((r, i) => drawRel(svgEl, r, i));
      if (spec.note) drawNote(svgEl, spec.note);
      const clsGroups = Object.fromEntries(Object.entries(spec.classes).map(([n, c]) => [n, drawClass(svgEl, n, c)]));
      views[key] = { svgEl, spec, relGroups, clsGroups, selected: null };
    }
    let current = "a";

    function renderUmlDefault() {
      const spec = UML[current];
      umlPanel.style.setProperty("--pc", "var(--border-strong)");
      umlPanel.innerHTML = `
        <p class="panel__kicker">diagramme ${current.toUpperCase()}</p>
        <h3>${current === "a" ? "Messages et streaming" : "Hiérarchie des événements"}</h3>
        <p>${escapeHtml(spec.intro)}</p>
        <p><em>Cliquez une classe pour voir ses champs, son rôle et ses relations.</em></p>`;
    }

    function renderClass(name) {
      const { spec } = views[current];
      const c = spec.classes[name];
      const color = c.ext ? "#8792ad" : `var(--${c.color})`;
      const rels = spec.rels
        .filter((r) => r.from === name || r.to === name)
        .map((r) => {
          const out = r.from === name;
          const other = spec.classes[out ? r.to : r.from];
          const role = r.role ? ` (${r.role[0]}${r.mult ? ", " + r.mult[0] : ""})` : "";
          return REL_TEXT[r.kind][out ? "from" : "to"](other.label || (out ? r.to : r.from), role);
        });
      const src = c.src || code(TYPES, c.line, `types.py:${c.line.replace("-", "–")}`);
      const fields = c.fields.length
        ? `<pre class="uml__fields"><code>${c.fields
            .map((f) => {
              const line = escapeHtml(f);
              return c.key && f.startsWith(c.key) ? `<span class="is-key">${line}</span>` : line;
            })
            .join("\n")}</code></pre>`
        : "";
      umlPanel.style.setProperty("--pc", color);
      umlPanel.innerHTML = `
        <p class="panel__kicker">${escapeHtml(c.stereo ? c.stereo + " " : "")}classe</p>
        <h3>${escapeHtml(c.label || name)}</h3>
        <div class="panel__grid">
          <div>
            <p>${escapeHtml(c.role)}</p>
            ${(c.notes || []).map((n) => `<p><em>${escapeHtml(n)}</em></p>`).join("")}
            ${fields ? `<p class="panel__label">${escapeHtml(c.fieldsLabel || (c.ext ? "Liste" : "Déclaration (champs Pydantic)"))}</p>${fields}` : ""}
          </div>
          <div>
            ${rels.length ? `<p class="panel__label">Relations</p><ul class="panel__types">${rels.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
            ${linkList([src])}
          </div>
        </div>`;
    }

    function selectClass(name) {
      const v = views[current];
      v.selected = v.selected === name ? null : name;
      const sel = v.selected;
      v.svgEl.classList.toggle("has-focus", !!sel);
      const related = new Set();
      v.spec.rels.forEach((r, i) => {
        const on = !!sel && (r.from === sel || r.to === sel);
        v.relGroups[i].classList.toggle("is-active", on);
        if (on) related.add(r.from).add(r.to);
      });
      // classes sharing the highlighted key field (tool_call_id) light up together
      const key = sel && v.spec.classes[sel].key;
      for (const [n, g] of Object.entries(v.clsGroups)) {
        g.classList.toggle("is-active", n === sel);
        g.classList.toggle("is-related", related.has(n) || (!!key && v.spec.classes[n].key === key));
        g.querySelectorAll(".cls__row--key").forEach((t) => t.classList.toggle("is-key", !!key));
      }
      if (sel) renderClass(sel);
      else renderUmlDefault();
    }

    for (const v of Object.values(views)) {
      for (const [n, g] of Object.entries(v.clsGroups)) {
        g.addEventListener("click", () => selectClass(n));
        g.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectClass(n);
          }
        });
      }
    }

    function showTab(key, focus) {
      current = key;
      tabs.forEach((t) => {
        const on = t.id === `tab-${key}`;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
        if (on && focus) t.focus();
      });
      const v = views[key];
      if (v.selected) {
        const name = v.selected;
        v.selected = null;
        selectClass(name);
      } else {
        renderUmlDefault();
      }
    }

    tabs.forEach((t, i) => {
      t.addEventListener("click", () => showTab(t.id.slice(-1)));
      t.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        showTab(next.id.slice(-1), true);
      });
    });

    renderUmlDefault();
  }

  // =========================================================================
  // §3 — Life of a message, legacy Python runtime (AgentLoop).
  // Values are examples; the path (functions, lines, types) is the real one.
  // Each link carries `expect`: text found on that line at commit 5e931ff3.
  // =========================================================================

  const LOOP = "vibe/core/agent_loop/_loop.py";
  const ref = (path, lines, label, expect) => ({ ...code(path, lines, label), expect });

  // A field row: [name, value]; values are colored by kind when rendered.
  const VARIANTS = {
    ls: { prompt: "Liste les fichiers de mon projet.", cmd: "ls", stdout: '"README.md\\nsrc\\ntests\\n"', answer: "Voici les fichiers : README.md, src et tests." },
    rm: { prompt: "Supprime le dossier build.", cmd: "rm -rf build", stdout: '""', answer: "Le dossier build a été supprimé." },
  };

  const H = { sys: "system", user: "user", call: "assistant · tool_calls", tool: "tool · bash", answer: "assistant" };

  const STEPS = [
    (v) => ({
      title: "Le prompt devient un LLMMessage",
      flow: "App Server → Agent Loop",
      comps: ["ui", "app", "loop"],
      history: [H.sys],
      text: [
        `L'interface envoie le texte à l'App Server, qui appelle <code>AgentLoop.act()</code>. La boucle construit un <code>LLMMessage</code> de rôle <code>user</code>.`,
        `Si l'App Server ne fournit pas d'identifiant, le validateur <code>_from_any</code> en génère un (UUID) : tout message non-<code>tool</code> a un <code>message_id</code>.`,
      ],
      objects: [
        { cls: "LLMMessage", fam: "msg", tag: "créé", rows: [["role", '"user"'], ["content", `"${v.prompt}"`], ["message_id", '"3f6c…e21a"'], ["tool_calls", "None"], ["injected", "False"]] },
      ],
      links: [ref(LOOP, "1676", "AgentLoop.act()", "async def act("), ref(LOOP, "2089-2097", "LLMMessage(role=Role.user, …)", "user_message = LLMMessage(")],
    }),
    (v) => ({
      title: "Le message rejoint l'historique",
      flow: "Agent Loop → MessageList, puis → App Server",
      comps: ["loop", "list", "app"],
      history: [H.sys, H.user],
      fresh: 1,
      text: [
        `Le message est ajouté à la <code>MessageList</code>, après le prompt système. La boucle annonce ensuite l'arrivée du message avec un <code>UserMessageEvent</code>.`,
        `C'est le premier événement du tour : pendant le tour, l'App Server suit la conversation par ces événements, pas en lisant la <code>MessageList</code>.`,
      ],
      objects: [
        { cls: "UserMessageEvent", fam: "event", tag: "émis", rows: [["content", `"${v.prompt}"`], ["message_id", '"3f6c…e21a"'], ["images", "[]"]] },
      ],
      links: [ref(LOOP, "2098", "self.messages.append(user_message)", "self.messages.append(user_message)"), ref(LOOP, "2105", "yield UserMessageEvent(…)", "yield UserMessageEvent(")],
    }),
    (v) => ({
      title: "La conversation part vers le modèle",
      flow: "Agent Loop → Backend LLM",
      comps: ["loop", "list", "llm"],
      history: [H.sys, H.user],
      text: [
        `La boucle appelle <code>backend.complete_streaming()</code> avec tous les messages et la liste des outils disponibles, chacun décrit par un <code>AvailableTool</code> (un schéma JSON).`,
        `<span class="sim__simplif">Simplification : la liste réelle des outils dépend de l'agent et de la configuration ; seul <code>bash</code> est montré.</span>`,
      ],
      objects: [
        { cls: "complete_streaming(…)", fam: "ext", tag: "appel", rows: [["messages", "[LLMMessage(system), LLMMessage(user)]"], ["tools", "[AvailableTool(bash), AvailableTool(read_file), …]"]] },
        { cls: "AvailableTool", fam: "msg", tag: "déclaration", rows: [["type", '"function"'], ["function.name", '"bash"'], ["function.parameters", '{"command": …, "timeout": …}']] },
      ],
      links: [ref(LOOP, "3378", "complete_streaming(…)", "async for chunk in self.backend.complete_streaming("), ref("vibe/core/llm/backend/generic.py", "477-488", "signature : Sequence[LLMMessage], list[AvailableTool]", "async def complete_streaming(")],
    }),
    (v) => ({
      title: "La réponse arrive en fragments",
      flow: "Backend LLM → Agent Loop",
      comps: ["llm", "loop"],
      history: [H.sys, H.user],
      text: [
        `Le modèle ne répond pas par du texte mais par un <strong>appel d'outil</strong>, et ses arguments JSON arrivent en morceaux, regroupés par <code>index</code>.`,
        `Dès que l'<code>id</code> et le nom de l'outil sont connus, la boucle émet un premier <code>ToolCallEvent</code>, <strong>sans arguments</strong>, pour que l'interface puisse afficher l'appel tôt. Pas d'<code>AssistantEvent</code> ici : aucun texte.`,
        `<span class="sim__simplif">L'usage (tokens) et la raison d'arrêt arrivent en général dans le dernier fragment ; la valeur exacte de <code>reason</code> dépend du fournisseur.</span>`,
      ],
      objects: [
        { cls: "LLMChunk #1", fam: "stream", tag: "reçu", rows: [["message.role", '"assistant"'], ["message.tool_calls", `[ToolCall(index=0, id="call_1", function=FunctionCall(name="bash", arguments='{"comm'))]`]] },
        { cls: "LLMChunk #2", fam: "stream", tag: "reçu", rows: [["message.tool_calls", `[ToolCall(index=0, function=FunctionCall(arguments='and": "${v.cmd}"}'))]`]] },
        { cls: "LLMChunk #3", fam: "stream", tag: "reçu", rows: [["usage", "LLMUsage(prompt_tokens=1840, completion_tokens=18)"], ["stop", 'StopInfo(reason="tool_calls")']] },
        { cls: "ToolCallEvent", fam: "event", tag: "émis tôt", rows: [["tool_call_id", '"call_1"'], ["tool_name", '"bash"'], ["args", "None"]] },
      ],
      links: [ref(LOOP, "2589-2594", "ToolCallEvent pendant le streaming", "event = ToolCallEvent("), ref(LOOP, "2603-2632", "_stream_assistant_events()", "async def _stream_assistant_events(")],
    }),
    (v) => ({
      title: "Les fragments sont additionnés",
      flow: "Agent Loop → MessageList",
      comps: ["loop", "list"],
      history: [H.sys, H.user, H.call],
      fresh: 2,
      text: [
        `Au fil du flux, la boucle calcule <code>chunk_agg = chunk_agg + chunk</code>. <code>LLMChunk.__add__</code> délègue à <code>LLMMessage.__add__</code>, qui recolle les arguments ayant le même <code>index</code> (détails dans le Streaming Lab, §4).`,
        `Le message assistant reconstruit rejoint l'historique et le <code>LLMUsage</code> cumulé met à jour <code>AgentStats</code>.`,
      ],
      objects: [
        { cls: "LLMMessage", fam: "msg", tag: "reconstruit", rows: [["role", '"assistant"'], ["content", "None"], ["tool_calls", `[ToolCall(id="call_1", index=0, function=FunctionCall(name="bash", arguments='{"command": "${v.cmd}"}'))]`]] },
        { cls: "AgentStats", fam: "stats", tag: "mis à jour", rows: [["last_turn_prompt_tokens", "1840"], ["last_turn_completion_tokens", "18"], ["session_prompt_tokens", "+= 1840"]] },
      ],
      links: [ref(LOOP, "3394-3398", "chunk_agg + processed_chunk", "processed_chunk = LLMChunk("), ref(LOOP, "3414-3416", "_update_stats puis messages.append", "self._update_stats(usage=usage")],
    }),
    (v) => ({
      title: "L'appel d'outil est validé",
      flow: "Agent Loop",
      comps: ["loop"],
      history: [H.sys, H.user, H.call],
      text: [
        `La boucle relit le dernier message, résout l'outil demandé et valide les arguments JSON avec le modèle Pydantic de l'outil, <code>BashArgs</code>.`,
        `Elle émet un second <code>ToolCallEvent</code>, cette fois <strong>avec</strong> les arguments validés. Les deux événements partagent le même <code>tool_call_id</code>.`,
      ],
      objects: [
        { cls: "BashArgs", fam: "ext", tag: "validé", rows: [["command", `"${v.cmd}"`], ["timeout", "None"]] },
        { cls: "ToolCallEvent", fam: "event", tag: "émis", rows: [["tool_call_id", '"call_1"'], ["tool_name", '"bash"'], ["tool_class", "Bash"], ["args", `BashArgs(command="${v.cmd}")`]] },
      ],
      links: [ref(LOOP, "2560-2561", "parse_message / resolve_tool_calls", "parsed = self.format_handler.parse_message("), ref(LOOP, "2649-2654", "ToolCallEvent avec args", "event = ToolCallEvent(")],
    }),
    (v) =>
      v.cmd === "ls"
        ? {
            title: "Permission : accordée par la configuration",
            flow: "Agent Loop",
            comps: ["loop"],
            history: [H.sys, H.user, H.call],
            text: [
              `L'outil bash analyse la commande. <code>ls</code> fait partie des commandes en lecture seule autorisées par défaut : la permission vaut <code>ALWAYS</code> et la décision est prise par la <strong>configuration</strong>.`,
              `<span class="sim__alert">Aucun <code>ApprovalRequestEvent</code> n'est émis : l'utilisateur n'est pas sollicité. Essayez la variante <code>rm -rf build</code>.</span>`,
              `<span class="sim__simplif">Cette analyse de commande s'applique sous un shell POSIX (Linux, macOS).</span>`,
            ],
            objects: [
              { cls: "PermissionContext", fam: "ext", tag: "Bash.resolve_permission", rows: [["permission", "ToolPermission.ALWAYS"]] },
              { cls: "ToolDecision", fam: "ext", tag: "décidé", rows: [["verdict", "EXECUTE"], ["approval_type", "ALWAYS"], ["approval_source", "CONFIG"]] },
            ],
            links: [ref("vibe/core/tools/builtins/bash.py", "81", '"ls" dans les commandes en lecture seule', '"ls",'), ref(LOOP, "3044-3049", "case ToolPermission.ALWAYS", "case ToolPermission.ALWAYS:")],
          }
        : {
            title: "Permission : l'utilisateur doit approuver",
            flow: "Agent Loop → App Server → Interface, puis retour",
            comps: ["loop", "app", "ui"],
            history: [H.sys, H.user, H.call],
            text: [
              `<code>rm</code> n'est pas une commande autorisée d'office : la permission vaut <code>ASK</code>. Les permissions requises n'étant pas déjà accordées, le <em>request broker</em> émet un <code>ApprovalRequestEvent</code> et la boucle <strong>attend</strong>, sur un <code>asyncio.Future</code>.`,
              `L'App Server transforme l'événement en demande pour l'interface. La réponse revient par <code>resolve_approval_request()</code> avec un <code>ApprovalResponse</code>.`,
              `<span class="sim__simplif">Si la permission avait déjà été accordée pendant la session, la décision serait <code>SMART</code>, sans demande.</span>`,
            ],
            objects: [
              { cls: "ApprovalRequestEvent", fam: "event", tag: "émis", rows: [["request_id", '"9b1d…"'], ["tool_name", '"bash"'], ["tool_args", 'BashArgs(command="rm -rf build")'], ["tool_call_id", '"call_1"'], ["required_permissions", "[RequiredPermission(…)]"]] },
              { cls: "ApprovalResponse", fam: "event", tag: "réponse", rows: [["value", 'ApprovalResponse.YES  # "y"']] },
              { cls: "ToolDecision", fam: "ext", tag: "décidé", rows: [["verdict", "EXECUTE"], ["approval_type", "ASK"], ["approval_source", "USER"]] },
            ],
            links: [ref("vibe/core/agent_loop/_request_broker.py", "52-62", "request_approval() : Future + événement", "request_id = str(uuid4())"), ref(LOOP, "3074-3095", "_ask_approval()", "async def _ask_approval("), ref(LOOP, "1147-1150", "resolve_approval_request()", "def resolve_approval_request(")],
          },
    (v) => ({
      title: "L'outil s'exécute, le résultat est enregistré",
      flow: "Agent Loop → Outil bash → Agent Loop → MessageList",
      comps: ["loop", "tool", "list"],
      history: [H.sys, H.user, H.call, H.tool],
      fresh: 3,
      text: [
        `Le résultat de l'outil est un modèle Pydantic. La boucle émet un <code>ToolResultEvent</code>, qui dit aussi <em>comment</em> l'appel a été autorisé.`,
        `Puis elle ajoute un message de rôle <code>tool</code>. Son texte est le résultat aplati en lignes « clé: valeur » ; sa version structurée est conservée dans <code>tool_result</code> (<code>PersistedToolResult</code>). Il n'a pas de <code>message_id</code> : il est relié à l'appel par <code>tool_call_id</code>.`,
      ],
      objects: [
        { cls: "ToolResultEvent", fam: "event", tag: "émis", rows: [["tool_call_id", '"call_1"'], ["tool_name", '"bash"'], ["result", `CapturedShellResult(command="${v.cmd}", exit_code=0, stdout=${v.stdout})`], ["decision", '"execute"'], ["approval_type", v.cmd === "ls" ? '"always"' : '"ask"'], ["approval_source", v.cmd === "ls" ? '"config"' : '"user"'], ["duration", "0.04"]] },
        { cls: "LLMMessage", fam: "msg", tag: "ajouté", rows: [["role", '"tool"'], ["tool_call_id", '"call_1"'], ["name", '"bash"'], ["content", `"command: ${v.cmd}\\n…\\nexit_code: 0\\nstdout: …"`], ["message_id", "None"], ["tool_result", "PersistedToolResult(output={…}, duration=0.04)"]] },
      ],
      links: [ref(LOOP, "2978-2992", "ToolResultEvent(…)", "result_event = ToolResultEvent("), ref("vibe/core/agent_loop_hooks.py", "234-244", "PersistedToolResult(…)", "PersistedToolResult("), ref("vibe/core/llm/format.py", "153-161", "create_tool_response_message()", "def create_tool_response_message(")],
    }),
    (v) => ({
      title: "Second tour, réponse finale, mise à jour de l'interface",
      flow: "Backend LLM → Agent Loop → App Server → Interface",
      comps: ["llm", "loop", "list", "app", "ui"],
      history: [H.sys, H.user, H.call, H.tool, H.answer],
      fresh: 4,
      text: [
        `Le dernier message étant de rôle <code>tool</code>, la boucle <strong>relance</strong> le modèle avec l'historique complet. Cette fois, la réponse est du texte : chaque fragment produit un <code>AssistantEvent</code>.`,
        `Sans nouvel appel d'outil, le tour se termine et l'historique est sauvegardé. Côté App Server, l'<code>EventProjector</code> traduit chaque événement en mise à jour publique pour l'interface : l'interface ne voit jamais les objets de <code>types.py</code>.`,
      ],
      objects: [
        { cls: "AssistantEvent", fam: "event", tag: "émis (×n)", rows: [["content", `"${v.answer.slice(0, 18)}"`], ["message_id", '"a71e…"']] },
        { cls: "LLMMessage", fam: "msg", tag: "ajouté", rows: [["role", '"assistant"'], ["content", `"${v.answer}"`], ["tool_calls", "None"]] },
        { cls: "HistoryEntryAdded / Updated", fam: "ext", tag: "public (App Server)", rows: [["→", "projection de l'événement pour l'interface"]] },
      ],
      links: [ref(LOOP, "2208", "should_break_loop = last_message.role != Role.tool", "should_break_loop = last_message.role != Role.tool"), ref(LOOP, "2187", "_save_messages() après chaque tour", "await self._save_messages()"), ref("vibe/app_server/_projector.py", "104", "EventProjector.project()", "def project(")],
    }),
  ];

  // Object cards, shared by §3 and §4. Colors a Python-ish value: literals, then strings.
  function colorValue(val) {
    if (/^(None|True|False|-?\d[\d.]*|\[\]|\+= \d+)$/.test(val)) return `<span class="n">${escapeHtml(val)}</span>`;
    // split on string literals first, then escape each piece (escaping first would hide the quotes)
    return val
      .split(/('[^']*'|"[^"]*")/)
      .map((part, i) => (i % 2 ? `<span class="s">${escapeHtml(part)}</span>` : escapeHtml(part)))
      .join("");
  }

  function renderObject(o) {
    const width = Math.max(...o.rows.map((r) => r[0].length));
    const body = o.rows.map(([k, val]) => `<span class="k">${escapeHtml(k.padEnd(width))}</span> = ${colorValue(val)}`).join("\n");
    return `<div class="obj obj--${o.fam}"><div class="obj__head"><span class="obj__name">${escapeHtml(o.cls)}</span><span class="obj__tag">${escapeHtml(o.tag)}</span></div><pre class="obj__body"><code>${body}</code></pre></div>`;
  }

  const sim = document.getElementById("sim");
  if (sim) {
    const $ = (id) => document.getElementById(id);
    const lanes = [...sim.querySelectorAll(".sim__lanes li")];
    const variantButtons = [...sim.querySelectorAll(".seg[data-variant]")];
    let step = 0;
    let variant = "ls";

    const dots = $("sim-dots");
    STEPS.forEach((_, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(i + 1);
      b.setAttribute("aria-label", `Aller à l'étape ${i + 1}`);
      b.addEventListener("click", () => go(i));
      li.appendChild(b);
      dots.appendChild(li);
    });
    const dotButtons = [...dots.querySelectorAll("button")];

    function render() {
      const s = STEPS[step](VARIANTS[variant]);
      $("sim-counter").textContent = `Étape ${step + 1} / ${STEPS.length}`;
      $("sim-flow").textContent = s.flow;
      $("sim-title").textContent = s.title;
      $("sim-text").innerHTML = s.text.map((t) => `<p>${t}</p>`).join("");
      $("sim-links").innerHTML = linkList(s.links);
      $("sim-objects").innerHTML = s.objects.map(renderObject).join("");
      $("sim-history").innerHTML = s.history
        .map((h, i) => `<li class="${i === s.fresh ? "is-new" : ""}"><span class="idx">[${i}]</span>${escapeHtml(h)}</li>`)
        .join("");
      lanes.forEach((li) => li.classList.toggle("is-on", s.comps.includes(li.dataset.comp)));
      dotButtons.forEach((b, i) => {
        b.classList.toggle("is-done", i < step);
        if (i === step) b.setAttribute("aria-current", "step");
        else b.removeAttribute("aria-current");
      });
      $("sim-prev").disabled = step === 0;
      $("sim-next").disabled = step === STEPS.length - 1;
    }

    function go(i) {
      step = Math.max(0, Math.min(STEPS.length - 1, i));
      render();
    }

    $("sim-next").addEventListener("click", () => go(step + 1));
    $("sim-prev").addEventListener("click", () => go(step - 1));
    $("sim-reset").addEventListener("click", () => go(0));
    variantButtons.forEach((b) =>
      b.addEventListener("click", () => {
        variant = b.dataset.variant;
        variantButtons.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        render();
      })
    );

    // ← / → step through the simulation while §3 is the current section.
    document.addEventListener("keydown", (event) => {
      if (currentSection !== "lifecycle" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable], [role="tab"]')) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(step + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(step - 1); }
    });

    render();
  }

  // =========================================================================
  // §4 — Streaming Lab. The aggregate is *computed* by a line-by-line port of
  // LLMMessage.__add__ (types.py:401-469) and LLMChunk.__add__ (types.py:509-519),
  // limited to the fields shown here. Fragments are shaped like those of the
  // Mistral backend (mistral.py:606-630): a fresh message_id per fragment,
  // a zero LLMUsage until the last one, stop only at the end.
  // =========================================================================

  const T = (lines, label) => ref(TYPES, lines, label || `types.py:${lines.replace("-", "–")}`, "");

  function addMessage(a, b, rules) {
    if (a.role !== b.role) throw new Error("Can't accumulate messages with different roles");
    const content = (a.content || "") + (b.content || "");
    if (a.content || b.content) {
      rules.push({ cls: "is-left", html: `<strong>content</strong> : concaténé « ${escapeHtml(a.content || "")} » + « ${escapeHtml(b.content || "")} » → « ${escapeHtml(content)} »`, link: T("412-414") });
    } else {
      rules.push({ cls: "is-left", html: `<strong>content</strong> : <code>""</code> + <code>""</code> → chaîne vide, donc <code>None</code>`, link: T("412-414") });
    }

    const map = new Map();
    for (const [side, calls] of [["left", a.tool_calls || []], ["right", b.tool_calls || []]]) {
      for (const tc of calls) {
        if (tc.index == null) throw new Error("Tool call chunk missing index");
        if (!map.has(tc.index)) {
          map.set(tc.index, { ...tc });
          if (side === "right") rules.push({ cls: "is-left", html: `<strong>tool_calls</strong> : nouvel index ${tc.index}, copié (<code>deepcopy</code>)`, link: T("432-433") });
          continue;
        }
        const cur = map.get(tc.index);
        if (cur.name && tc.name && cur.name !== tc.name) throw new Error("Can't accumulate messages with different tool call names");
        if (tc.name && !cur.name) cur.name = tc.name;
        const before = cur.arguments || "";
        cur.arguments = before + (tc.arguments || "");
        if (side === "right") {
          rules.push({ cls: "is-sum", html: `<strong>tool_calls[index=${tc.index}]</strong> : même index, arguments recollés <code>${escapeHtml(`'${before}'`)}</code> + <code>${escapeHtml(`'${tc.arguments || ""}'`)}</code>${tc.name ? "" : " (le nom manque dans ce fragment : on garde « " + escapeHtml(cur.name) + " »)"}`, link: T("434-446") });
        }
      }
    }

    rules.push({ cls: "is-left", html: `<strong>message_id</strong> : celui de <em>gauche</em> est gardé (<code>${b.message_id}</code> est ignoré)`, link: T("460") });
    return { role: a.role, content: content || null, message_id: a.message_id, tool_calls: map.size ? [...map.values()] : null };
  }

  const sumUsage = (x, y) => ({ p: x.p + y.p, c: x.c + y.c });
  const fmtUsage = (u) => (u ? `LLMUsage(prompt_tokens=${u.p}, completion_tokens=${u.c})` : "None");

  function addChunk(a, b, rules) {
    const message = addMessage(a.message, b.message, rules);
    let usage = null;
    if (a.usage || b.usage) {
      usage = sumUsage(a.usage || { p: 0, c: 0 }, b.usage || { p: 0, c: 0 });
      rules.push({ cls: "is-sum", html: `<strong>usage</strong> : additionné champ par champ → <code>${fmtUsage(usage)}</code>`, link: T("510-513") });
    }
    const correlation_id = b.correlation_id || a.correlation_id;
    if (b.correlation_id || a.correlation_id) rules.push({ cls: "is-right", html: `<strong>correlation_id</strong> : celui de <em>droite</em> l'emporte s'il existe`, link: T("517") });
    const stop = b.stop || a.stop;
    rules.push({ cls: "is-right", html: b.stop ? `<strong>stop</strong> : celui de <em>droite</em> l'emporte → <code>StopInfo(reason="${b.stop}")</code>` : `<strong>stop</strong> : <code>None</code> à droite, on garde ${a.stop ? "celui de gauche" : "<code>None</code>"}`, link: T("518") });
    return { message, usage, correlation_id, stop };
  }

  const fmtCalls = (calls) =>
    calls ? `[${calls.map((t) => `ToolCall(index=${t.index}${t.id ? `, id="${t.id}"` : ""}, name=${t.name ? `"${t.name}"` : "None"}, arguments='${t.arguments}')`).join(", ")}]` : "None";

  function chunkRows(ch) {
    const rows = [["message.content", ch.message.content == null ? "None" : JSON.stringify(ch.message.content)], ["message.message_id", `"${ch.message.message_id}"`]];
    if (ch.message.tool_calls || ch.kind === "tool") rows.push(["message.tool_calls", fmtCalls(ch.message.tool_calls)]);
    rows.push(["usage", fmtUsage(ch.usage)], ["correlation_id", ch.correlation_id ? `"${ch.correlation_id}"` : "None"], ["stop", ch.stop ? `StopInfo(reason="${ch.stop}")` : "None"]);
    return rows;
  }

  const frag = (kind, id, content, extra = {}) => ({
    kind,
    message: { role: "assistant", content, message_id: id, tool_calls: extra.calls || null },
    usage: extra.usage || { p: 0, c: 0 },
    correlation_id: "c-42",
    stop: extra.stop || null,
  });

  const SCENARIOS = {
    text: [
      frag("text", "a1f0…", "Bon"),
      frag("text", "7c2e…", "jour"),
      frag("text", "e93b…", " !", { usage: { p: 1200, c: 3 }, stop: "stop" }),
    ],
    tool: [
      frag("tool", "a1f0…", "", { calls: [{ index: 0, id: "call_1", name: "bash", arguments: '{"comm' }] }),
      frag("tool", "7c2e…", "", { calls: [{ index: 0, id: null, name: null, arguments: 'and": "l' }] }),
      frag("tool", "e93b…", "", { calls: [{ index: 0, id: null, name: null, arguments: 's"}' }], usage: { p: 1840, c: 18 }, stop: "tool_calls" }),
    ],
  };

  const lab = document.getElementById("lab");
  if (lab) {
    const $ = (id) => document.getElementById(id);
    const scenarioButtons = [...lab.querySelectorAll(".seg[data-scenario]")];
    let scenario = "text";
    let pos = 1; // number of fragments received

    function compute(upTo) {
      const frags = SCENARIOS[scenario];
      let agg = null;
      let rules = [];
      for (let i = 0; i < upTo; i++) {
        rules = [];
        if (agg === null) {
          agg = structuredClone(frags[i]);
          rules.push({ cls: "is-first", html: `<code>chunk_agg</code> valait <code>None</code> : il devient simplement ce premier fragment, sans addition.`, link: ref(LOOP, "3394-3398", "_loop.py:3394–3398", "") });
          rules.push({ cls: "", html: `Chaque fragment est un <code>LLMMessage</code> créé sans <code>message_id</code> : le validateur <code>_from_any</code> lui en attribue un nouveau.`, link: T("373-374") });
        } else {
          agg = addChunk(agg, frags[i], rules);
        }
      }
      return { frag: frags[upTo - 1], agg, rules };
    }

    function renderNaive() {
      const frags = SCENARIOS[scenario].slice(0, pos);
      if (scenario === "text") {
        $("lab-naive").innerHTML = `
          <p>Pour le texte, une concaténation naïve donnerait le même <code>content</code> : « ${escapeHtml(frags.map((f) => f.message.content).join(""))} ».</p>
          <p>La différence est ailleurs : l'<strong>identité</strong> (on garde le <code>message_id</code> du premier fragment, celui que l'interface connaît déjà), l'<strong>usage</strong> (on additionne) et le <strong>stop</strong> (on garde le plus récent).</p>`;
      } else {
        const naive = frags.flatMap((f) => f.message.tool_calls);
        $("lab-naive").innerHTML = `
          <p>Mettre bout à bout les listes <code>tool_calls</code> donnerait <strong>${naive.length} appel${naive.length > 1 ? "s" : ""}</strong>, dont ${naive.filter((t) => !t.name).length} sans nom, aux arguments incomplets :</p>
          <p class="lab__expr">${escapeHtml(fmtCalls(naive))}</p>
          <p>Le vrai <code>+</code> regroupe les fragments par <code>index</code> : un seul appel, nom conservé, arguments recollés.</p>`;
      }
    }

    function render() {
      const frags = SCENARIOS[scenario];
      const { frag: f, agg, rules } = compute(pos);
      $("lab-counter").textContent = `Fragment ${pos} / ${frags.length}`;
      $("lab-in").innerHTML = renderObject({ cls: `LLMChunk #${pos}`, fam: "stream", tag: "reçu", rows: chunkRows(f) });
      $("lab-rules").innerHTML = rules
        .map((r) => `<li class="${r.cls}">${r.html} <a href="${r.link.url}" target="_blank" rel="noopener">${escapeHtml(r.link.label)}</a></li>`)
        .join("");
      $("lab-out").innerHTML = renderObject({ cls: "chunk_agg", fam: "stream", tag: pos === 1 ? "= fragment #1" : `= #1 + … + #${pos}`, rows: chunkRows({ ...agg, kind: scenario }) });

      const json = $("lab-json");
      json.hidden = scenario !== "tool";
      if (scenario === "tool") {
        const args = agg.message.tool_calls[0].arguments;
        let ok = true;
        try { JSON.parse(args); } catch { ok = false; }
        json.className = `lab__json ${ok ? "is-ok" : "is-ko"}`;
        json.textContent = ok ? `✔ arguments = ${args} : JSON valide, l'outil peut être appelé` : `✘ arguments = ${args} : JSON encore incomplet`;
      }
      renderNaive();
      $("lab-prev").disabled = pos === 1;
      $("lab-next").disabled = pos === frags.length;
    }

    function go(n) {
      pos = Math.max(1, Math.min(SCENARIOS[scenario].length, n));
      render();
    }

    $("lab-next").addEventListener("click", () => go(pos + 1));
    $("lab-prev").addEventListener("click", () => go(pos - 1));
    $("lab-reset").addEventListener("click", () => go(1));
    scenarioButtons.forEach((b) =>
      b.addEventListener("click", () => {
        scenario = b.dataset.scenario;
        scenarioButtons.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        go(1);
      })
    );

    // Edge cases run the same port, so the error comes from the same rule.
    const EDGES = {
      role: {
        expr: 'LLMMessage(role="assistant", content="a") + LLMMessage(role="user", content="b")',
        run: () => addMessage({ role: "assistant", content: "a", message_id: "x" }, { role: "user", content: "b", message_id: "y" }, []),
        link: T("403-404"),
        why: "Additionner deux messages n'a de sens que pour les morceaux d'un même message.",
      },
      index: {
        expr: "LLMMessage(tool_calls=[ToolCall(index=0, …)]) + LLMMessage(tool_calls=[ToolCall(index=None, …)])",
        run: () => addMessage({ role: "assistant", tool_calls: [{ index: 0, name: "bash", arguments: "" }], message_id: "x" }, { role: "assistant", tool_calls: [{ index: null, arguments: "{" }], message_id: "y" }, []),
        link: T("430-431"),
        why: "Sans index, impossible de savoir à quel appel rattacher le fragment.",
      },
      name: {
        expr: 'ToolCall(index=0, name="bash") + ToolCall(index=0, name="grep")',
        run: () => addMessage({ role: "assistant", tool_calls: [{ index: 0, name: "bash", arguments: "" }], message_id: "x" }, { role: "assistant", tool_calls: [{ index: 0, name: "grep", arguments: "" }], message_id: "y" }, []),
        link: T("437-440"),
        why: "Un même index ne peut pas désigner deux outils différents.",
      },
    };
    lab.querySelectorAll(".seg[data-edge]").forEach((b) =>
      b.addEventListener("click", () => {
        const e = EDGES[b.dataset.edge];
        let msg = "(aucune erreur)";
        try { e.run(); } catch (err) { msg = `ValueError: ${err.message}`; }
        lab.querySelectorAll(".seg[data-edge]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        $("lab-edge").innerHTML = `<p class="lab__expr">${escapeHtml(e.expr)}</p><p class="lab__error">${escapeHtml(msg)}</p><p>${escapeHtml(e.why)} <a href="${e.link.url}" target="_blank" rel="noopener">${escapeHtml(e.link.label)}</a></p>`;
      })
    );

    document.addEventListener("keydown", (event) => {
      if (currentSection !== "streaming" || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable], [role="tab"]')) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(pos + 1); }
      if (event.key === "ArrowLeft") { event.preventDefault(); go(pos - 1); }
    });

    render();
  }

  // =========================================================================
  // §5 — Design choices, by level. Each card: problem, solution, benefit,
  // a real example and links whose `expect` text is checked like in §3.
  // =========================================================================

  const PROJ = "vibe/app_server/_projector.py";
  const adr = (n, file) => ({ label: `ADR ${n}`, url: `../../../adr/${file}` });

  const DESIGN = [
    { level: "style", title: "Architecture événementielle",
      problem: "L'interface doit suivre en direct un tour long (streaming, outils, approbations) sans connaître l'intérieur de la boucle.",
      solution: "act() est un générateur asynchrone qui produit des BaseEvent typés ; l'App Server les projette pour les clients.",
      benefit: "Le même moteur sert le terminal, ACP et le mode programmatique ; les tests observent simplement les événements.",
      example: "async def act(...) -> AsyncGenerator[BaseEvent, None]",
      links: [ref(LOOP, "1689", "_loop.py:1689", ") -> AsyncGenerator[BaseEvent, None]:"), ref(PROJ, "104", "EventProjector.project()", "def project("), adr("0003", "0003-event-driven-agent-loop.md")] },
    { level: "style", title: "Cœur séparé des interfaces",
      problem: "Remplacer une interface (Textual → Rust) ne doit pas obliger à modifier le moteur.",
      solution: "types.py n'importe aucun module d'interface ; les interfaces ne reçoivent que les modèles publics de l'App Server.",
      benefit: "On change d'interface sans toucher au modèle de données.",
      example: "Mesuré : 0 fichier de vibe/cli, vibe/acp ou vibe/cli-rust n'importe vibe.core.types.",
      links: [ref(TYPES, "29-33", "les imports de types.py", "from vibe.core.experiments.models import EvalResponse"), adr("0002", "0002-core-engine-and-delivery-surfaces.md")] },

    { level: "pattern", title: "Observer",
      problem: "Le RewindManager doit savoir quand l'historique est remplacé, sans que la boucle pense à le prévenir.",
      solution: "MessageList.on_reset(hook) enregistre des abonnés et reset() les notifie. Même principe pour AgentStats.add_listener(), déclenché par __setattr__.",
      benefit: "Le sujet ignore qui l'observe : la MessageList ne connaît rien du rewind.",
      example: "self._messages.on_reset(self._on_messages_reset)   # rewind/manager.py",
      caveat: "AgentStats ne garde qu'un abonné par champ : un second add_listener() remplace le premier.",
      links: [ref(TYPES, "686-695", "MessageList.on_reset() / reset()", "def on_reset("), ref("vibe/core/rewind/manager.py", "37", "abonnement du RewindManager", "self._messages.on_reset("), ref(TYPES, "78-90", "AgentStats.__setattr__ / add_listener", "def __setattr__(")] },
    { level: "pattern", title: "Value Object",
      problem: "Pendant le streaming, chaque fragment est à la fois transmis à l'appelant et accumulé : personne ne doit le modifier en route.",
      solution: "LLMUsage, StopInfo et LLMChunk sont figés (frozen=True) ; + renvoie un nouvel objet au lieu de modifier l'existant.",
      benefit: "Ces objets se partagent sans copie défensive.",
      example: "model_config = ConfigDict(frozen=True)",
      caveat: "Le gel est superficiel : le LLMMessage contenu dans un LLMChunk reste modifiable.",
      links: [ref(TYPES, "473", "LLMUsage", "model_config = ConfigDict(frozen=True)"), ref(TYPES, "503", "LLMChunk", "model_config = ConfigDict(frozen=True)")] },
    { level: "pattern", title: "Data Transfer Object",
      problem: "Faire passer des données du moteur à l'App Server sans y attacher de logique.",
      solution: "Les événements sont des modèles qui ne portent que des champs typés.",
      benefit: "Faciles à projeter, à journaliser et à tester.",
      example: "class ToolResultEvent(BaseEvent):\n    tool_name: str\n    result: BaseModel | None = None\n    …",
      caveat: "Une exception : AssistantEvent définit __add__ pour regrouper le texte.",
      links: [ref(TYPES, "562-576", "ToolResultEvent", "class ToolResultEvent(BaseEvent):")] },

    { level: "tech", title: "Modèles Pydantic",
      problem: "Valider ce qui vient des fournisseurs et relire ce qui a été écrit sur disque.",
      solution: "Presque chaque type est un BaseModel : extra=\"forbid\" pour les enregistrements écrits par Vibe, extra=\"ignore\" pour les données externes.",
      benefit: "Validation et sérialisation JSON sans code supplémentaire.",
      example: 'message.model_dump(exclude_none=True, mode="json")',
      links: [ref("vibe/core/session/session_logger.py", "442", "écriture d'un message sur disque", 'model_dump(exclude_none=True, mode="json")'), ref(TYPES, "331", 'ManualShellContext : extra="forbid"', 'model_config = ConfigDict(extra="forbid")'), ref(TYPES, "347", 'LLMMessage : extra="ignore"', 'model_config = ConfigDict(extra="ignore")')] },
    { level: "tech", title: "Polymorphisme vérifié par le typage",
      problem: "Oublier de traiter un nouveau type d'événement.",
      solution: "Le projecteur fait un match sur une union d'événements et termine par assert_never : pyright signale tout cas oublié.",
      benefit: "Ajouter un événement oblige à décider comment l'afficher.",
      example: "case _:\n    assert_never(event)",
      links: [ref(PROJ, "787-828", "NoticeEvent et _notice_data()", "type NoticeEvent = (")] },
    { level: "tech", title: "Surcharge de l'opérateur +",
      problem: "Reconstruire un message à partir de dizaines de fragments.",
      solution: "__add__ est défini sur LLMMessage, LLMChunk, LLMUsage et AssistantEvent.",
      benefit: "Dans la boucle, l'agrégation tient en une ligne.",
      example: "chunk_agg = processed_chunk if chunk_agg is None else chunk_agg + processed_chunk",
      caveat: "Non commutatif : l'ordre des opérandes compte (voir le Streaming Lab).",
      links: [ref(TYPES, "401", "LLMMessage.__add__", "def __add__(self, other: LLMMessage)"), ref(LOOP, "3394-3398", "utilisation dans la boucle", "processed_chunk = LLMChunk(")] },
    { level: "tech", title: "Union discriminée, StrEnum et Literal",
      problem: "Représenter des choix fermés sans chaînes libres sujettes aux fautes.",
      solution: "ImageAttachment.source choisit sa classe selon kind ; Role est un StrEnum ; approval_source est un Literal.",
      benefit: "Valeurs sérialisées en texte simple, et vérifiées par pyright.",
      example: 'source: Annotated[FileImageSource | InlineImageSource, Field(discriminator="kind")]',
      links: [ref(TYPES, "303", "ImageAttachment.source", "source: Annotated["), ref(TYPES, "271", "Role", "class Role(StrEnum):")] },
    { level: "tech", title: "Validateurs « before » et migration paresseuse",
      problem: "Relire des sessions écrites par d'anciennes versions, et des contenus au format des fournisseurs.",
      solution: "Des validateurs exécutés avant Pydantic normalisent l'entrée : liste de morceaux → texte, ancien format d'image → nouveau.",
      benefit: "Aucun script de migration : les anciens fichiers sont convertis à la lecture.",
      example: '{"path": …, "alias": …}  →  {"source": {"kind": "file", "path": …}, "alias": …}',
      links: [ref(TYPES, "307-318", "ImageAttachment._migrate_flat_source", '@model_validator(mode="before")'), ref(TYPES, "254-268", "Content et _content_before", "def _content_before(")] },
    { level: "tech", title: "Import réservé au typage",
      problem: "tools/base.py importe types.py : l'import inverse créerait un cycle.",
      solution: "BaseTool n'est importé que sous TYPE_CHECKING ; à l'exécution, il vaut Any.",
      benefit: "Des types exacts pour pyright, sans cycle à l'exécution.",
      example: "if TYPE_CHECKING:\n    from vibe.core.tools.base import BaseTool\nelse:\n    BaseTool = Any",
      links: [ref(TYPES, "13-16", "types.py:13–16", "if TYPE_CHECKING:")] },
  ];

  const LEVEL_LABEL = { style: "Style architectural", pattern: "Pattern", tech: "Technique" };
  const designGrid = document.getElementById("design-cards");

  if (designGrid) {
    designGrid.innerHTML = DESIGN.map((d) => `
      <article class="dcard dcard--${d.level}" data-level="${d.level}">
        <p class="dcard__level">${LEVEL_LABEL[d.level]}</p>
        <h3>${escapeHtml(d.title)}</h3>
        <p><strong>Problème.</strong> ${escapeHtml(d.problem)}</p>
        <details>
          <summary>Solution, avantage, exemple</summary>
          <dl>
            <dt>Solution</dt><dd>${escapeHtml(d.solution)}</dd>
            <dt>Avantage</dt><dd>${escapeHtml(d.benefit)}</dd>
            <dt>Exemple réel</dt><dd><pre class="dcard__example"><code>${escapeHtml(d.example)}</code></pre></dd>
          </dl>
          ${d.caveat ? `<p class="dcard__caveat">Limite : ${escapeHtml(d.caveat)}</p>` : ""}
          ${linkList(d.links)}
        </details>
      </article>`).join("");

    const cards = [...designGrid.querySelectorAll(".dcard")];
    const levelButtons = [...document.querySelectorAll(".seg[data-level]")];
    levelButtons.forEach((b) => {
      const n = b.dataset.level === "all" ? cards.length : cards.filter((c) => c.dataset.level === b.dataset.level).length;
      b.textContent += ` (${n})`;
      b.addEventListener("click", () => {
        levelButtons.forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        cards.forEach((c) => { c.hidden = b.dataset.level !== "all" && c.dataset.level !== b.dataset.level; });
      });
    });

    const toggle = document.getElementById("design-toggle");
    toggle.addEventListener("click", () => {
      const open = toggle.textContent === "Tout déplier";
      cards.forEach((c) => { c.querySelector("details").open = open; });
      toggle.textContent = open ? "Tout replier" : "Tout déplier";
    });
  }

  // --- Keyboard: 1–6 jump to a section, 0 back to the top -----------------
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]")) return;

    if (event.key === "0") {
      document.getElementById("top")?.scrollIntoView();
      return;
    }
    const index = Number.parseInt(event.key, 10);
    if (index >= 1 && index <= SECTION_IDS.length) {
      document.getElementById(SECTION_IDS[index - 1])?.scrollIntoView();
    }
  });
})();
