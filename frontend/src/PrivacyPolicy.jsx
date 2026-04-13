import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="legal-page">
      <div className="legal-container">
        <button className="legal-back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>

        <h1 className="legal-title">Privacy Policy</h1>
        <p className="legal-date">Compliant with GDPR (DSGVO)</p>

        <section className="legal-section">
          <h2>1. Information We Collect</h2>
          <p>We only collect information that you voluntarily provide to us:</p>
          <ul>
            <li><strong>Account Data:</strong> Name and email address.</li>
            <li><strong>Profile Data:</strong> Current institute, profile pictures, bio, academic titles, spoken languages, contact information, research interests, skills, etc...</li>
            <li><strong>User Content:</strong> Projects, events, comments and posts.</li>
            <li><strong>Application Data:</strong> Documents (CVs, etc.) you upload to apply for projects.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>2. How We Use Your Data</h2>
          <p>
            Your data is used exclusively to provide the platform's social features. 
            Email addresses are used for account verification and password resets. 
            Uploaded documents are only shared with the creator of the project you are applying to.
          </p>
        </section>

        <section className="legal-section">
          <h2>3. Data Storage and Security</h2>
          <p>
            We host our data within the EU. We use industry-standard encryption to protect 
            your passwords and documents. Since this is a university project, we recommend 
            not using the same password you use for sensitive services (like banking).
          </p>
        </section>

        <section className="legal-section">
          <h2>4. Your Rights (GDPR)</h2>
          <p>Under the GDPR, you have the following rights regarding your data:</p>
          <ul>
            <li><strong>Right to Access:</strong> See what data we have about you.</li>
            <li><strong>Right to Rectification:</strong> Fix incorrect data.</li>
            <li><strong>Right to Erasure:</strong> Delete your account and all associated data.</li>
            <li><strong>Right to Withdraw Consent:</strong> Stop us from processing your data at any time.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>5. Contact Information</h2>
          <p>
            For any privacy-related concerns or to request data deletion, please contact 
            the Peer Grid project team through emre.guecer [at] student [dot] uni-tuebingen [dot] de.
          </p>
        </section>
      </div>
    </div>
  );
}