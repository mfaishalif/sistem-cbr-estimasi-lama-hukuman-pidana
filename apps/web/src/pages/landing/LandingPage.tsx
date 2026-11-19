import { CaseBaseFact } from '@/components/landing/CaseBaseFact';
import { Hero } from '@/components/landing/Hero';
import { Limits } from '@/components/landing/Limits';
import { Reveal } from '@/components/landing/Reveal';
import { Steps } from '@/components/landing/Steps';

/**
 * #beranda: hero, three steps, one case-base fact, limits. The hero carries
 * its own py-16/py-24; the rest are 64px (mobile) / 96px (desktop) apart.
 */
export function LandingPage({ onOpenHowItWorks }: { onOpenHowItWorks: () => void }) {
  return (
    <div>
      <Reveal>
        <Hero />
      </Reveal>
      <div className="space-y-16 pb-16 lg:space-y-24 lg:pb-24">
        <Reveal>
          <Steps />
        </Reveal>
        <Reveal>
          <CaseBaseFact />
        </Reveal>
        <Reveal>
          <Limits onOpenHowItWorks={onOpenHowItWorks} />
        </Reveal>
      </div>
    </div>
  );
}
