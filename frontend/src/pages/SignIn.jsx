import { useEffect, useRef, useState } from "react";

import "../styles/signin.css";

export default function SignIn({ error, loading, onNavigateSignUp, onSubmit }) {
  const cardRef = useRef(null);
  const fieldRefs = useRef([]);
  const buttonRef = useRef(null);
  const [form, setForm] = useState({
    employeeName: "",
    employeeId: "",
    password: "",
  });

  useEffect(() => {
    const gsap = window.gsap;
    if (!gsap || !cardRef.current) return;

    const fields = fieldRefs.current.filter(Boolean);
    const timeline = gsap.timeline();
    timeline
      .fromTo(cardRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" })
      .fromTo(fields, { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.08, duration: 0.32, ease: "power2.out" }, "-=0.2")
      .fromTo(buttonRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.28, ease: "back.out(1.5)" }, "-=0.1");
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      employee_name: form.employeeName,
      employee_id: form.employeeId,
      password: form.password,
    });
  };

  return (
    <div className="signin-page">
      <form className="signin-card" onSubmit={handleSubmit} ref={cardRef}>
        <div className="signin-heading">Sign In</div>

        <div className="signin-fields">
          <label
            className="signin-field"
            ref={(node) => {
              fieldRefs.current[0] = node;
            }}
          >
            <span>Employee Name</span>
            <input
              type="text"
              name="employeeName"
              value={form.employeeName}
              onChange={handleChange}
              placeholder="Enter your name"
              required
            />
          </label>

          <label
            className="signin-field"
            ref={(node) => {
              fieldRefs.current[1] = node;
            }}
          >
            <span>Employee ID</span>
            <input
              type="text"
              name="employeeId"
              value={form.employeeId}
              onChange={handleChange}
              placeholder="EY-100"
              required
            />
          </label>

          <label
            className="signin-field"
            ref={(node) => {
              fieldRefs.current[2] = node;
            }}
          >
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter password"
              required
            />
          </label>
        </div>

        {error ? <div className="signin-error">{error}</div> : null}

        <button className="signin-submit" type="submit" ref={buttonRef} disabled={loading}>
          {loading ? "Signing In..." : "Sign In"}
        </button>

        <div className="signin-footer">
          Don&apos;t have an account?{" "}
          <button className="auth-inline-link" type="button" onClick={onNavigateSignUp}>
            Register
          </button>
        </div>
      </form>
    </div>
  );
}
