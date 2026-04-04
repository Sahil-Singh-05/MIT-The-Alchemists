import { useEffect, useRef, useState } from "react";

import "../styles/signup.css";

export default function SignUp({ error, loading, onNavigateSignIn, onSubmit }) {
  const cardRef = useRef(null);
  const fieldRefs = useRef([]);
  const buttonRef = useRef(null);
  const [form, setForm] = useState({
    employeeName: "",
    email: "",
    phoneNumber: "",
    employeeId: "",
    password: "",
    confirmPassword: "",
  });
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    const gsap = window.gsap;
    if (!gsap || !cardRef.current) return;

    const fields = fieldRefs.current.filter(Boolean);
    const timeline = gsap.timeline();
    timeline
      .fromTo(cardRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.55, ease: "power2.out" })
      .fromTo(fields, { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.07, duration: 0.3, ease: "power2.out" }, "-=0.2")
      .fromTo(buttonRef.current, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.28, ease: "back.out(1.5)" }, "-=0.1");
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLocalError("");

    if (form.password.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    await onSubmit({
      employee_name: form.employeeName,
      email: form.email,
      phone_number: form.phoneNumber,
      employee_id: form.employeeId,
      password: form.password,
    });
  };

  return (
    <div className="signup-page">
      <form className="signup-card" onSubmit={handleSubmit} ref={cardRef}>
        <div className="signup-heading">Sign Up</div>

        <div className="signup-fields">
          {[
            ["Employee Name", "employeeName", "text", "Enter your name"],
            ["Email", "email", "email", "employee@alchemist.com"],
            ["Phone Number", "phoneNumber", "tel", "+91 98765 43210"],
            ["Employee ID", "employeeId", "text", "EY-100"],
            ["Set Password", "password", "password", "Create password"],
            ["Confirm Password", "confirmPassword", "password", "Repeat password"],
          ].map(([label, name, type, placeholder], index) => (
            <label
              className="signup-field"
              key={name}
              ref={(node) => {
                fieldRefs.current[index] = node;
              }}
            >
              <span>{label}</span>
              <input
                type={type}
                name={name}
                value={form[name]}
                onChange={handleChange}
                placeholder={placeholder}
                required
              />
            </label>
          ))}
        </div>

        {localError || error ? <div className="signup-error">{localError || error}</div> : null}

        <button className="signup-submit" type="submit" ref={buttonRef} disabled={loading}>
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <div className="signup-footer">
          Already have an account?{" "}
          <button className="auth-inline-link" type="button" onClick={onNavigateSignIn}>
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
}
