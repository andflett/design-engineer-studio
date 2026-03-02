export function Privacy() {
  return (
    <main className="max-w-[640px] mx-auto px-6 pt-32 pb-24">
      <a
        href="#"
        className="inline-flex items-center gap-1.5 text-xs text-ink3 hover:text-ink2 transition-colors font-mono mb-8"
      >
        &larr; Back
      </a>

      <h1 className="text-2xl font-semibold tracking-tight mb-2">
        Privacy Policy
      </h1>
      <p className="text-xs text-ink3 font-mono mb-10">
        Last updated — March 2, 2026
      </p>

      <div className="space-y-6 text-[15px] text-ink2 leading-relaxed">
        <section>
          <h2 className="text-base font-semibold text-ink mb-2">
            What we collect
          </h2>
          <p>
            When you join the waitlist we store your <strong>email address</strong> and
            the date you signed up. That's it — no cookies, no tracking pixels, no
            analytics scripts.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-2">
            How we use it
          </h2>
          <p>
            Your email is used solely to notify you about product availability and
            important updates related to designtools. We will never sell, rent, or
            share your email address with third parties.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-2">
            Where it's stored
          </h2>
          <p>
            Emails are stored in an encrypted Redis database hosted on Upstash
            infrastructure via Vercel. Data is transmitted over HTTPS and encrypted
            at rest.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-2">
            Your rights
          </h2>
          <p>
            You can request deletion of your data at any time by emailing us. We
            will remove your information within 30 days of receiving your request.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-ink mb-2">Contact</h2>
          <p>
            Questions about this policy? Reach out via{" "}
            <a
              href="https://github.com/AJFletcher/designtools"
              target="_blank"
              rel="noopener"
              className="underline hover:text-ink transition-colors"
            >
              GitHub
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
