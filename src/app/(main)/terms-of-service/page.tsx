
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl font-bold">Terms of Service</CardTitle>
           <p className="text-sm text-muted-foreground">Last Updated: [Date]</p>
        </CardHeader>
        <CardContent className="space-y-6 text-muted-foreground">
            <p>Welcome to CheapBite! These Terms of Service ("Terms") govern your use of our application and services. By creating an account or using our app, you agree to these Terms.</p>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">1. Acceptable Use Policy</h2>
            <p>You agree not to use the app to:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Post any content that is illegal, harmful, threatening, abusive, or otherwise objectionable.</li>
                <li>Spam other users with unwanted messages or invites.</li>
                <li>Infringe on any third party's intellectual property rights, including posting copyrighted recipes without permission.</li>
                <li>Attempt to disrupt or compromise our systems, or access data you are not authorized to access.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">2. User-Generated Content</h2>
            <p>
             You retain ownership of all content you create, including recipes, photos, and meal plans ("User Content"). However, by posting User Content, you grant us a worldwide, non-exclusive, royalty-free license to use, reproduce, display, and distribute your User Content in connection with providing and promoting the app. For example, we may use your anonymized recipe data to improve our AI.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">3. AI and Content Disclaimers</h2>
            <p className='font-semibold text-destructive/90'>Our AI-powered recipe and nutritional suggestions are for informational purposes only and are not a substitute for professional medical or dietary advice.</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Allergies & Dietary Needs:</strong> The AI is a tool, not a certified nutritionist. You are responsible for verifying that recipes meet your specific health, allergy, and dietary requirements. Always double-check ingredients.</li>
                <li><strong>No Warranty:</strong> We are not liable for any adverse reactions, including food poisoning or allergic reactions, resulting from the use of recipes found in the app. Cook and consume at your own risk.</li>
            </ul>
          </section>
           <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">4. Account Responsibility & Termination</h2>
            <p>
              You are responsible for safeguarding your account password and for all activities that occur under your account. We reserve the right to suspend or terminate your account at any time if you violate these Terms, without notice.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">5. Subscriptions and Payments</h2>
            <p>
             Our Pro Plan is a paid subscription processed through Stripe. By upgrading, you agree to pay the subscription fees. All payments are handled by Stripe, and you are subject to their terms of service. Subscriptions auto-renew unless canceled. You can manage your subscription through the app.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">6. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, CheapBite shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from your use of our service.
            </p>
          </section>
           <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">7. Changes to These Terms</h2>
            <p>
              We may modify these Terms from time to time. If we make material changes, we will provide you with notice through our service or by other means to provide you the opportunity to review the changes before they become effective.
            </p>
          </section>
           <section>
            <h2 className="text-xl font-semibold text-foreground mb-2">8. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at: professional.mathematics.ja@gmail.com
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

    