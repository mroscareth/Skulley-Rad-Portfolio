import { R as React, a as jsxRuntimeExports } from "./vendor-kJyMmUE3.js";
function ContactForm() {
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
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-xl mx-auto text-left space-y-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-2xl font-bold", children: "¡Gracias!" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "opacity-90", children: "He recibido tu mensaje. Resumen:" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "text-sm space-y-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Nombre:" }),
          " ",
          name
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Email:" }),
          " ",
          email
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Asunto:" }),
          " ",
          subject
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Comentarios:" }),
          " ",
          comments
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", className: "inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white transition-colors", onClick: () => {
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
  }, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "w-full text-left mx-auto", style: { maxWidth: "840px" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-6", "aria-live": "polite", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between text-sm opacity-80 mb-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
          "Paso ",
          step + 1,
          " de ",
          steps.length
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: steps[step].id })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-2 bg-white/20 rounded-full overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-full bg-white/80", style: { width: `${(step + 1) / steps.length * 100}%` } }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: `space-y-2 will-change-transform ${direction === "forward" ? "animate-[slideleft_260ms_ease]" : "animate-[slideright_260ms_ease]"}`, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-2xl font-bold", htmlFor: `field-${steps[step].id}`, children: steps[step].label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm opacity-80", children: steps[step].desc }),
      step === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          id: "field-name",
          ref: nameRef,
          type: "text",
          value: name,
          onChange: (e) => setName(e.target.value),
          onKeyDown,
          className: "mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white",
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
          className: "mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white",
          placeholder: "tu@email.com",
          autoComplete: "email",
          required: true
        }
      ),
      step === 2 && /* @__PURE__ */ jsxRuntimeExports.jsxs("fieldset", { className: "mt-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("legend", { className: "sr-only", children: "Asunto" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-3", children: ["Trabajemos juntos", "Colaboración", "Otro"].map((opt, i) => {
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
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `block w-full rounded-full px-5 py-4 bg-white/10 hover:bg-white/15 text-white ring-1 ring-white/25 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-white ${selected ? "bg-white/20 ring-2 ring-white" : ""}`, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex items-center gap-3", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `relative inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ${selected ? "ring-white" : "ring-white/80"}`, children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `absolute inset-1 rounded-full ${selected ? "bg-black opacity-100" : "bg-black opacity-0"} transition-opacity` }) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: opt })
            ] }) })
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
          rows: 8,
          className: "mt-3 w-full px-4 py-3 rounded-md bg-white/95 text-black placeholder-black/50 focus:outline-none focus:ring-2 focus:ring-white",
          placeholder: "Escribe tus comentarios (Shift+Enter para salto de línea)",
          required: true
        }
      ),
      !!error && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-red-200 mt-2", role: "alert", children: error })
    ] }, step),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: prev, disabled: step === 0, className: "px-4 py-2 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-40", children: "Atrás" }),
      step < 3 ? /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "button", onClick: next, className: "px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white", children: "Siguiente" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("button", { type: "submit", className: "px-4 py-2 rounded-md bg-white/90 text-black hover:bg-white", children: "Enviar" })
    ] })
  ] }) });
}
function Section4() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "contact-section text-black fixed inset-0 grid place-items-center px-4 overflow-hidden", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "contact-wrap", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ContactForm, {}) }) });
}
export {
  Section4 as default
};
