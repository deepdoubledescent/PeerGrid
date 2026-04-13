import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfUse() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        
        <h1 className="legal-title">Terms of Use</h1>
        <p className="legal-date">Last Updated: April 13, 2026</p>

        <section className="legal-section">
          <h2>§1 Scope of Service</h2>
          <p>
            Peer Grid (peer-grid.de) is a social platform developed as a university project. 
            The platform is designed to facilitate networking, the sharing of project ideas, 
            and collaborative opportunities within an educational context.
          </p>
        </section>

        <section className="legal-section">
          <h2>§2 User Conduct</h2>
          <p>By using Peer Grid, you agree to:</p>
          <ul>
            <li>Provide accurate information during registration.</li>
            <li>Maintain the confidentiality of your account credentials.</li>
            <li>Refrain from posting content that is illegal, offensive, or infringes on the rights of others.</li>
            <li>Use the "Project Application" feature only for legitimate educational purposes.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>§3 Intellectual Property</h2>
          <p>
            You retain the rights to any content you post (ideas, posts, pictures). By posting, 
            you grant Peer Grid a limited license to display this content to other users on 
            the platform. The platform's source code and design are open source.
          </p>
        </section>

        <section className="legal-section">
          <h2>§4 Disclaimer of Liability</h2>
          <p>
            As this is a <strong>non-commercial university project</strong>, we provide the service "as-is." 
            We do not guarantee 100% uptime, and we are not responsible for any data loss or 
            misunderstandings resulting from user interactions. We act in good faith and expect our users to do the same.
            Our project is non-profit and we do not accept any liability claims.
          </p>
        </section>
      </div>
    </div>
  );
}