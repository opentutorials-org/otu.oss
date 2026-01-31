import { docs } from '../docs';

export const privacyPolicy: docs = {
    version: '2024-6-20',
    title: 'Privacy Policy',
    body: `
    <p>This Privacy Policy explains the measures taken by the non-profit organization OpenTutorials (hereinafter referred to as "Operator") to protect the personal information of users of the OTU service (hereinafter referred to as "Service").</p>
    
    <h2>Article 2 (Collection and Use of Personal Information)</h2>
    <p>The Operator collects minimal personal information necessary for service provision, and the collected personal information is used for the following purposes:</p>
    <ol>
        <li>Service provision and operation</li>
        <li>Member management</li>
        <li>Service improvement and new service development</li>
    </ol>
    
    <h2>Article 3 (Data Management Methods)</h2>
    <ol>
        <li>User data access rights: Only a limited number of authorized engineers can access real data in a strictly controlled environment.</li>
        <li>Data retention period: Data is immediately deleted after membership withdrawal.</li>
    </ol>
    
    <h2>Article 4 (Data Provided to Third Parties)</h2>
    <ol>
        <li>Text data: supabase database (SOC 2 Type 2)</li>
        <li>Image files: uploadcare (SOC 2 Type 2 and ISO 27001)</li>
        <li>AI chat, AI content generation: openai (SOC 2 Type 2)</li>
        <li>Embeddings: User data is vectorized and stored for AI-based responses using Vercel AI Gateway (SOC 2 Type II)</li>
        <li>User authentication information: Using social login through apple, google, and github, the Operator does not store user authentication information.</li>
    </ol>
    
    <h2>Article 5 (Methods for User Data Modification and Deletion Requests)</h2>
    <p>Users can modify or request deletion of their data using the withdrawal function in the service settings menu.</p>
    
    <h2>Article 6 (Technical and Administrative Measures for Personal Information Protection)</h2>
    <p>The Operator implements various security measures to prevent unauthorized access and leakage of personal information.</p>
    
    <h2>Article 7 (Notification Obligation for Policy Changes)</h2>
    <p>In case of additions, deletions, or modifications to this Privacy Policy, changes will be announced within the service at least 7 days prior to implementation.</p>
    
    <p>This Privacy Policy is effective from June 20, 2024.</p>`,
};
