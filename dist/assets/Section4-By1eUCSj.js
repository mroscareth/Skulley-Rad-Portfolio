import { R as React, a as jsxRuntimeExports } from "./vendor-kJyMmUE3.js";
function ContactForm() {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(Boolean(mql.matches));
    update();
    try {
      mql.addEventListener("change", update);
    } catch {
      window.addEventListener("resize", update);
    }
    return () => {
      try {
        mql.removeEventListener("change", update);
      } catch {
        window.removeEventListener("resize", update);
      }
    };
  }, []);
  const [step, setStep] = React.useState(0);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("Trabajemos juntos");
  const [comments, setComments] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState("");
  const nameRef = React.useRef(null);
  const emailRef = React.useRef(null);
  const commentsRef = React.useRef(null);
  const firstRadioRef = React.useRef(null);
  const prevStepRef = React.useRef(0);
  React.useEffect(() => {
    setError("");
    const f = () => {
      if (step === 0) nameRef.current?.focus();
      else if (step === 1) emailRef.current?.focus();
      else if (step === 2) firstRadioRef.current?.focus();
      else if (step === 3) commentsRef.current?.focus();
    };
    const t = setTimeout(f, 50);
    return () => clearTimeout(t);
  }, [step]);
  const isValidEmail = (v) => /.+@.+\..+/.test(String(v || "").toLowerCase());
  function next() {
    if (step === 0) {
      if (!name.trim()) return setError("Por favor ingresa tu nombre");
    }
    if (step === 1) {
      if (!email.trim()) return setError("Por favor ingresa tu email");
      if (!isValidEmail(email)) return setError("Email no válido");
    }
    if (step === 3) {
      if (!comments.trim()) return setError("Cuéntame un poco en comentarios");
      setSubmitted(true);
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function prev() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }
  function onKeyDown(e) {
    if (e.key !== "Enter") return;
    if (step !== 3) {
      e.preventDefault();
      next();
      return;
    }
    if (!e.shiftKey) {
      e.preventDefault();
      next();
    }
  }
  const prevStep = prevStepRef.current;
  const direction = step >= prevStep ? "forward" : "backward";
  React.useEffect(() => {
    prevStepRef.current = step;
  }, [step]);
  if (submitted) {
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full mx-auto text-center", style: { maxWidth: "840px" }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "font-marquee text-black uppercase leading-none text-[clamp(72px,14vw,240px)] inline-block mx-auto ml-[-0.35em]", children: "¡GRACIAS!" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-4 text-lg text-black/90", children: "He recibido tu mensaje, pronto estaré en contacto contigo." }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "mt-6 px-6 py-3 rounded-full bg-black text-white hover:bg-black/90", onClick: () => {
        setSubmitted(false);
        setStep(0);
      }, children: "Enviar otro" })
    ] });
  }
  const steps = [
    { id: "name", label: "¿Cómo te llamas?", desc: "Escribe tu nombre" },
    { id: "email", label: "¿Cuál es tu email?", desc: "Para poder responderte" },
    { id: "subject", label: "¿Sobre qué quieres hablar?", desc: "Elige una opción" },
    { id: "comments", label: "Cuéntame más", desc: "Añade detalles, enlaces o ideas" }
  ];
  return /* @__PURE__ */ jsxRuntimeExports.jsx("form", { className: "pointer-events-auto", onSubmit: (e) => {
    e.preventDefault();
    next();
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full mx-auto text-black text-center", style: { maxWidth: "840px" }, children: [
    !isMobile && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "mb-10 fixed left-1/2 -translate-x-1/2 z-[14000] pointer-events-none",
        "aria-live": "polite",
        style: { width: "min(840px, 92vw)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" },
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 bg-black/10 rounded-full overflow-hidden ring-1 ring-black/15", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-black transition-all duration-300 ease-out", style: { width: `${(step + 1) / steps.length * 100}%` } }) })
      }
    ),
    !isMobile && /* @__PURE__ */ jsxRuntimeExports.jsx(
      "div",
      {
        className: "fixed left-1/2 -translate-x-1/2 z-[14010] pointer-events-auto",
        style: { width: "min(840px, 92vw)", bottom: "calc(env(safe-area-inset-bottom, 0px) + 155px)" },
        children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 w-full", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: prev, disabled: step === 0, className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-40", children: "Atrás" }),
          step < 3 ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: next, className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto", children: "Siguiente" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto", children: "Enviar" })
        ] })
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `space-y-2 will-change-transform ${direction === "forward" ? "animate-[slideleft_260ms_ease]" : "animate-[slideright_260ms_ease]"}`, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: isMobile ? "block font-marquee text-4xl text-black uppercase" : "block font-marquee text-5xl sm:text-6xl text-black uppercase", htmlFor: `field-${steps[step].id}`, children: steps[step].label }),
      step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          id: "field-name",
          ref: nameRef,
          type: "text",
          value: name,
          onChange: (e) => setName(e.target.value),
          onKeyDown,
          className: "mt-4 w-full px-4 py-3 rounded-full bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto",
          placeholder: "Tu nombre",
          autoComplete: "name",
          required: true
        }
      ),
      step === 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          id: "field-email",
          ref: emailRef,
          type: "email",
          value: email,
          onChange: (e) => setEmail(e.target.value),
          onKeyDown,
          className: "mt-4 w-full px-4 py-3 rounded-full bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto",
          placeholder: "tu@email.com",
          autoComplete: "email",
          required: true
        }
      ),
      step === 2 && /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { className: "mt-2", style: { marginTop: "30px" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { className: "sr-only", children: "Asunto" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: isMobile ? "grid grid-cols-1 gap-3 justify-items-stretch" : "grid grid-cols-1 sm:grid-cols-3 gap-3 justify-items-center", children: ["Trabajemos juntos", "Colaboración", "Otro"].map((opt, i) => {
          const selected = subject === opt;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "cursor-pointer select-none", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              "input",
              {
                ref: i === 0 ? firstRadioRef : null,
                type: "radio",
                name: "subject",
                value: opt,
                checked: selected,
                onChange: () => setSubject(opt),
                className: "sr-only peer"
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `block w-full text-center rounded-full px-6 py-4 transition-all duration-200 ${selected ? "bg-black text-white ring-2 ring-black scale-[1.02]" : "bg-transparent text-black ring-2 ring-black hover:bg-black/5"} peer-focus-visible:ring-2 peer-focus-visible:ring-black`, children: opt })
          ] }, opt);
        }) })
      ] }),
      step === 3 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "textarea",
        {
          id: "field-comments",
          ref: commentsRef,
          value: comments,
          onChange: (e) => setComments(e.target.value),
          onKeyDown: (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              next();
            }
          },
          rows: isMobile ? 6 : 8,
          className: "mt-4 w-full px-4 py-3 rounded-2xl bg-black text-white placeholder-white/60 ring-1 ring-white/15 focus:outline-none focus:ring-2 focus:ring-white mx-auto",
          placeholder: "Escribe tus comentarios (Shift+Enter para salto de línea)",
          required: true
        }
      ),
      !!error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-red-600 mt-2 font-medium", role: "alert", children: error })
    ] }, step),
    isMobile && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-8 w-full", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between gap-3 w-full", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: prev, disabled: step === 0, className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 disabled:opacity-40", children: "Atrás" }),
        step < 3 ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: next, className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto", children: "Siguiente" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "px-5 py-2 rounded-full bg-black text-white hover:bg-black/90 ml-auto", children: "Enviar" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-4 h-2 bg-black/10 rounded-full overflow-hidden ring-1 ring-black/15", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-black transition-all duration-300 ease-out", style: { width: `${(step + 1) / steps.length * 100}%` } }) })
    ] })
  ] }) });
}
function Section4() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "contact-section text-black fixed inset-0 grid place-items-center px-4 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "contact-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ContactForm, {}) }) });
}
export {
  Section4 as default
};
