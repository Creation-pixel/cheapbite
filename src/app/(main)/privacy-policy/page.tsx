
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl font-bold">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">Last Updated: [Date]</p>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
            <p>
              Welcome to Cheap Bite ("we," "us," "our"). We operate a recipe AI, social calendar, and dinner invitation application. This policy explains how we collect, use, disclose, and safeguard your information when you use our application. We are committed to protecting your privacy and ensuring you have a positive experience.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">2. Information We Collect</h2>
            <p>We may collect information about you in a variety of ways. The information we may collect via the Application includes:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Personal Identifiers:</strong> Your name, email address, and profile picture when you register or connect a social media account (e.g., Google, Facebook).</li>
              <li><strong>Dietary & Preference Data:</strong> Information you voluntarily provide, such as dietary restrictions (e.g., vegan, gluten-free), allergies, and cuisine preferences.</li>
              <li><strong>Content You Create:</strong> Recipes you save, meal plans you create in the planner, comments you post, and dinner invitations you send. Photos you upload for ingredient or meal identification are processed to provide the service and are not stored long-term unless part of a saved recipe.</li>
              <li><strong>Usage Data:</strong> We use Firebase Analytics to automatically collect information about how you interact with our app, such as features used, time spent, and clicks. This helps us improve the service.</li>
              <li><strong>Device & Technical Data:</strong> Your IP address, browser type, operating system, and device model, which are collected automatically to help us diagnose problems and provide a better service.</li>
              <li><strong>Financial Data:</strong> When you subscribe to our Pro Plan, your payment information (e.g., credit card number) is collected and processed by our third-party payment processor, Stripe. We do not store your full financial details on our servers.</li>
            </ul>
             <p className="mt-4 font-semibold">We want to be clear: We do not sell your personal data to third-party marketers or data brokers.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">3. How We Use Your Information</h2>
            <p>Having accurate information about you permits us to provide you with a smooth, efficient, and customized experience. Specifically, we may use information collected about you to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Create and manage your account.</li>
                <li>Provide core app functionality, such as generating personalized recipes, scheduling your meal planner, and enabling user-to-user invitations.</li>
                <li>Process payments for subscriptions through Stripe.</li>
                <li>Personalize your experience based on your preferences.</li>
                <li>Enable user-to-user communications (e.g., messaging and invites).</li>
                <li>Monitor and analyze usage and trends to improve the Application.</li>
                <li>Respond to customer service requests and send you service-related notifications.</li>
                <li>Prevent fraudulent transactions, and protect against criminal activity.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">4. How We Share Your Data</h2>
             <p>We do not share your personal information with third parties except in the situations described below:</p>
             <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>With Service Providers:</strong> We share data with third-party vendors that perform services for us. This includes Google (for Firebase services like Authentication, Firestore, and Analytics) and Stripe (for payment processing). These providers have their own privacy policies governing how they use your data.</li>
                <li><strong>User Interactions:</strong> When you interact with other users (e.g., send an invite or a message), they will see your profile name and photo.</li>
                <li><strong>By Law or to Protect Rights:</strong> We may share your information if we believe it's necessary to respond to a legal process, investigate potential policy violations, or protect the rights, property, and safety of others.</li>
                <li><strong>Aggregated/Anonymized Data:</strong> We may share anonymized, aggregated data (which cannot be used to identify you) for research or statistical purposes, such as "70% of our users are interested in vegetarian recipes."</li>
             </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">5. Data Retention & Deletion</h2>
            <p>
              We retain your personal data for as long as your account is active or as needed to provide you with our services. If you choose to delete your account, we will delete your personal information, including your profile, saved recipes, and meal plans from our primary production databases. Please note that we may retain some information as required by law or for legitimate business purposes like security and fraud prevention.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">6. Your Rights (GDPR/CCPA)</h2>
            <p>Depending on your location, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>The right to access the personal data we hold about you.</li>
                <li>The right to request that we correct any inaccurate personal data.</li>
                <li>The right to request that we delete your personal data.</li>
                <li>The right to opt-out of certain data processing activities.</li>
            </ul>
            <p className="mt-2">To exercise these rights, please contact us at the email address provided below. You can delete your account and its associated data at any time through the app's settings.</p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">7. Children’s Privacy</h2>
            <p>
              Our app is not intended for use by children under the age of 13. We do not knowingly collect personal information from children. If we become aware that we have collected data from a child under 13, we will take steps to delete that information immediately.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">8. Security of Your Information</h2>
            <p>
             We use administrative, technical, and physical security measures to help protect your personal information. This includes using Firebase's built-in security features, secure Firestore rules, and encrypting data in transit. While we have taken reasonable steps to secure your data, please be aware that no security measures are perfect, and no method of data transmission can be guaranteed against any interception or misuse.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to — and maintained on — computers located outside of your state, province, or country, including the United States, where data protection laws may differ. We rely on legally-provided mechanisms to lawfully transfer data across borders.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last Updated" date.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">11. Contact Us</h2>
            <p>
              If you have questions or comments about this Privacy Policy, please contact us at: professional.mathematics.ja@gmail.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

    