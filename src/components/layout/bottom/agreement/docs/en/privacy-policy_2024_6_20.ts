import { docs } from '../docs';

export const privacyPolicy: docs = {
    version: '2026-2-7',
    title: 'Privacy Policy',
    body: `
    <p>This Privacy Policy explains the measures taken by the non-profit organization OpenTutorials (hereinafter "Operator") to protect the personal information of users of the OTU service (hereinafter "Service"), in accordance with applicable laws including the Korean Personal Information Protection Act, the EU GDPR, and the California CCPA.</p>
    <p>The Software of this Service is an open-source project released under the <strong>MIT License</strong>. This Privacy Policy applies to the hosted service (otu.ai) operated by the Operator. If you self-host the Software, the privacy policy of your hosting operator applies.</p>

    <h2>Article 1 (Collection and Use of Personal Information)</h2>
    <p>The Operator collects minimal personal information necessary for service provision, and the collected personal information is used for the following purposes:</p>
    <ol>
        <li>Service provision and operation</li>
        <li>Member management</li>
        <li>Service improvement and new service development</li>
        <li>Service performance monitoring and error analysis</li>
    </ol>

    <h2>Article 2 (Data Management Methods)</h2>
    <ol>
        <li>User data access rights: Only a limited number of authorized engineers can access real data in a strictly controlled environment.</li>
        <li>Data retention period: Data is immediately deleted after membership withdrawal, except as required by applicable laws.</li>
        <li>Data protection: All data is encrypted with <strong>AES-256</strong>, and data in transit is protected using <strong>TLS 1.3</strong>.</li>
    </ol>

    <h2>Article 3 (Data Provided to Third Parties)</h2>
    <ol>
        <li>Text data storage: Supabase (SOC 2 Type 2)</li>
        <li>Image file storage: Uploadcare (SOC 2 Type 2 and ISO 27001)</li>
        <li>AI chat and AI content generation: OpenAI (SOC 2 Type 2)</li>
        <li>Data embeddings for AI-based responses: Vercel AI Gateway (SOC 2 Type II)</li>
        <li>Service performance monitoring and error analysis:
            <ul>
                <li>Vercel Analytics (SOC 2 Type 2 and GDPR compliant)</li>
            </ul>
        </li>
        <li>User authentication: Using social login through Apple, Google, and GitHub. The Operator does not store user authentication credentials.</li>
    </ol>
    <p>The Operator has entered into data processing agreements with the above third parties to ensure appropriate measures for the protection of personal information.</p>

    <h2>Article 4 (Tracking and Advertising Policy)</h2>
    <p>The Operator <strong>does not serve advertisements</strong> and does not use advertising identifiers (e.g., IDFA, AAID) that track user behavior.</p>
    <p>Furthermore, the Operator <strong>does not engage in cross-app or cross-site tracking</strong>. User behavioral data during service use is utilized solely for analytics purposes, aimed at service improvement and performance monitoring.</p>

    <h2>Article 5 (User Rights and How to Exercise Them)</h2>
    <p>Users may exercise the following rights:</p>
    <ol>
        <li>Request to access, correct, or delete personal information</li>
        <li>Request to suspend processing of personal information</li>
        <li>Withdraw consent</li>
    </ol>
    <p>Users can exercise these rights through the settings menu within the Service or by contacting customer support. The Operator will take prompt action in accordance with applicable laws.</p>

    <h2>Article 6 (Technical and Administrative Measures for Personal Information Protection)</h2>
    <p>The Operator implements the following security measures to prevent unauthorized access and leakage of personal information:</p>
    <ul>
        <li>All data is encrypted using the AES-256 algorithm.</li>
        <li>TLS 1.3 is used for network transmission to enhance data security.</li>
        <li>Access rights are granted only to minimal personnel, and regular security audits are conducted.</li>
    </ul>

    <h2>Article 7 (Open Source Software)</h2>
    <p>The source code of this Service is publicly available on <a href="https://github.com/opentutorials-org/otu.oss" target="_blank" rel="noopener">GitHub</a>. If you self-host the Software, you must establish your own privacy policy independently, and this policy does not apply.</p>

    <h2>Article 8 (International Data Transfer)</h2>
    <p>Some personal information collected during service provision may be processed on servers in the United States and other countries. The Operator applies appropriate security measures and protects personal information in accordance with applicable laws.</p>

    <h2>Article 9 (Privacy Officer and Contact Information)</h2>
    <p>The Operator has designated the following Privacy Officer to handle inquiries and complaints related to personal information protection:</p>
    <p>Officer: Duru Kang</p>
    <p>Email: duru@opentutorials.org</p>

    <h2>Article 10 (Notification Obligation for Policy Changes)</h2>
    <p>In case of additions, deletions, or modifications to this Privacy Policy, changes will be announced within the Service at least 7 days prior to implementation.</p>

    <p>This Privacy Policy is effective from February 7, 2026.</p>`,
};
