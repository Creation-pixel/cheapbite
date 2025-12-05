
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { HandHeart, Users, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { VolunteerForm } from '@/components/volunteer-form';


export default function OfferHelpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">
          Our Story, Our Legacy
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          From a Negril Restaurant in the 90s to a Social Media Food App.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild>
            <Link href="https://creationandtheuniverse.myshopify.com/products/support-our-restaurant-donate?variant=46019701932226" target="_blank" rel="noopener noreferrer">Donate Now <ExternalLink className="ml-2 h-4 w-4"/></Link>
          </Button>
          <VolunteerForm />
        </div>
      </div>

      <Card className="overflow-hidden shadow-lg">
        <CardContent className="p-0">
          <div className="relative h-64 w-full">
            <Image
              src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FRES95lnly95lnly95ln.png?alt=media&token=9f282f8d-15d6-43e1-aa30-d8239acbcb95"
              alt="A portrait of the Pinnock family"
              layout="fill"
              objectFit="cover"
              data-ai-hint="family portrait caribbean"
            />
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-semibold tracking-tight">The Story of Cheap Bite</h2>
            <p className="mt-4 text-muted-foreground">
              Negril in the 1990s was a different world — a time when tourists from all over the globe, not just America, filled the streets. Europeans flocked to Negril for the food, the reggae, the dancehall, and the raw vybe. Back then, MX3 Lane was alive, Alfred’s Ocean Palace drew crowds, “the bus” was the after-hours spot, and tucked along the road — not on the beach — was a family-owned gem that became legendary: Cheap Bite Garden Restaurant & Bar.
            </p>
            <p className="mt-4 text-muted-foreground">
              Cheap Bite wasn’t just a place to eat — it was a whole movement. The restaurant in the front, the bar to the side, and a stage at the back turned it into one of the few places that combined authentic Jamaican food with major live shows. Big names like Buju Banton, Capleton, and Sizzla all touched the Cheap Bite stage before they became global icons. It was the kind of place where tourists sat side by side with locals, Red Stripe cold in hand, plates of jerk chicken or curried goat in front of them, while the music shook the ground and the spirit of Negril danced in the air.
            </p>
             <p className="mt-4 text-muted-foreground">
              For more than a decade, Cheap Bite was part of the foundation that made Negril Negril. A budget-friendly spot with real vibes — you could get half-price lunch specials, a cheeseburger or fried chicken chalked on the daily board, and then come back in the evening for a stage show that drew the whole town.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-8">
        <div className="text-center">
            <h2 className="text-3xl font-bold text-primary">A Legacy Reborn</h2>
        </div>
        <div className="relative aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
             <Image
                src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FRESmxx5vqmxx5vqmxx5.png?alt=media&token=fcf70d84-7c00-406a-beb9-d7d4ad02f23c"
                alt="Cheap Bite Garden Restaurant & Bar in Negril"
                layout="fill"
                objectFit="contain"
                data-ai-hint="jamaica restaurant 1990s"
            />
        </div>
        <div className="text-center max-w-2xl mx-auto">
            <p className="mt-4 text-muted-foreground">
                Founded by Father Everald Pinnock and his wife Erica Brown Pinnock, their journey took a turn. After government pressure and property struggles, the family lost the spot. The owner partnered briefly with Travellers Beach Resort, then moved operations to Little London before finally closing down for good. Eventually, he migrated to America, still working in the cooking industry, but with a new path: he found God and started The Get It Ministry, preaching and teaching online.
            </p>
            <p className="mt-4 text-muted-foreground">
                And then — life came full circle. Years later, his son, Antoine Pinnock, surprised him with a gift in honor of the old days: The Cheap Bite Recipe Sharing & Food Social Media App.
            </p>
            <p className="mt-4 text-muted-foreground">
                This isn’t just a cookbook app. It’s powered by AI to help people recreate dishes from every cuisine, just like Cheap Bite used to mix Jamaican and international flavors. You can discover recipes, review restaurants, and even set dinner dates with friends inside the app. It’s like the old Cheap Bite — food, vibes, and community — reborn for the digital age.
            </p>
        </div>
      </div>
      
      <Separator />

      <div className="text-center">
          <h2 className="text-3xl font-bold">Why This Story Matters</h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            This man is living history. He knew the ins and outs of early Negril, he saw the rise of the reggae and dancehall legends, and he ran a restaurant that was as much a stage for music as it was for food. He can tell legendary stories about:
          </p>
      </div>

      <ul className="space-y-2 text-muted-foreground list-disc list-inside">
        <li>When European backpackers mixed with American spring breakers in the same bar, and Negril was still rough, raw, and free.</li>
        <li>The behind-the-scenes moments of putting on stage shows with Jamaica’s biggest artists before they blew up.</li>
        <li>What the food culture in Negril was really like — which spots on the beach had the real vibes (Alfred’s, MX3, The Bus, Roots Bamboo) and how Cheap Bite stood out as a roadside alternative.</li>
        <li>The struggles of running a family-owned place in Jamaica during the 90s, and what it meant to lose it all.</li>
        <li>How faith and food intertwined in his journey, leading him from Negril to America, and from running a bar to running an online ministry.</li>
        <li>How his son’s creation of the Cheap Bite App resurrects his legacy, blending tradition with modern AI to connect food, culture, and people around the world.</li>
      </ul>
      
       <div className="text-center p-6 bg-primary/10 rounded-lg">
          <h2 className="text-2xl font-bold">Support the Dream</h2>
          <p className="mt-2 max-w-2xl mx-auto text-muted-foreground">
            This is more than just a restaurant story. It’s a tale of Negril’s golden era, family, survival, faith, and reinvention. Please offer your support; this might help to get the restaurant back in Negril and even a branch near you one day.
          </p>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="text-center">
            <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <HandHeart className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="mt-4">Make a Contribution</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>
                    Your financial support helps us cover server costs, development, and community outreach.
                </CardDescription>
                <Button asChild className="mt-4">
                    <Link href="https://creationandtheuniverse.myshopify.com/products/support-our-restaurant-donate?variant=46019701932226" target="_blank" rel="noopener noreferrer">Donate Now <ExternalLink className="ml-2 h-4 w-4"/></Link>
                </Button>
            </CardContent>
        </Card>
         <Card className="text-center">
            <CardHeader>
                <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
                    <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="mt-4">Become a Volunteer</CardTitle>
            </CardHeader>
            <CardContent>
                <CardDescription>
                    Have skills in marketing, community management, or design? We'd love to hear from you.
                </CardDescription>
                <VolunteerForm />
            </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">A Slice of the 90's: Cheap Bite Archives</h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            Check out the level vibes at Cheap Bite Garden Restaurant. Real good Jamaican and International food. Fast service daily til midnight! Happy hour 6:30 to 9:30 - check out our evening Red Stripe special! Live entertainment Monday, Thursday and Saturday - Monday is Ladies Night - free rum punch or white wine for the ladies, a complimentary dinner to the most lucky lady! Open 8:30am - our breakfasts includes a free cup of world famous Blue Mountain coffee.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2Fcbcoffee.jpg?alt=media&token=44980498-be1f-48a8-b5e2-7286d5cb6f66" alt="Blue Mountain Coffee at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="coffee cup vintage" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2Fcbsign2.jpg?alt=media&token=63de14c3-76be-4c17-9b3f-922b4bc1a2ba" alt="Cheap Bite Restaurant Sign" layout="fill" objectFit="cover" data-ai-hint="restaurant sign wooden" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2Fdrum001.jpg?alt=media&token=591d44a7-7dea-45a0-95da-275a8eec39a0" alt="Drummer performing at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="drummer musician live" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2Fsmallaxe.jpg?alt=media&token=aa753530-466d-4d62-9cc6-a6953baacc7a" alt="Small Axe band playing" layout="fill" objectFit="cover" data-ai-hint="reggae band jamaica" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FIMG-20251128-WA0014.jpg?alt=media&token=3ca23e91-00c0-4307-87b0-ecbc32b32554" alt="Everald Pinnock at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="man portrait vintage" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FIMG-20251130-WA0001.jpg?alt=media&token=7bd3ba76-5f32-4a9c-b74f-8e3b3717c5da" alt="Performer on stage at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="singer stage performance" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FIMG-20251130-WA0002.jpg?alt=media&token=99b8eda9-7c09-4458-909d-acd3f98cedfd" alt="Live band performing on stage at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="band stage music" />
            </div>
            <div className="relative aspect-square w-full rounded-lg overflow-hidden">
                <Image src="https://firebasestorage.googleapis.com/v0/b/studio-9102275022-76c3c.firebasestorage.app/o/Legacy-Restaurant%2FIMG-20251130-WA0003.jpg?alt=media&token=97a631f8-04ca-443f-87f4-c14fb1949fb6" alt="Live performance at Cheap Bite" layout="fill" objectFit="cover" data-ai-hint="live music performance" />
            </div>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Archived Articles</CardTitle>
                <CardDescription>Travel back in time with these articles from RealNegril.com.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {[
                        { href: 'https://www.realnegril.com/beingees/cheapbyt.htm', text: 'Cheap Bite on Beingee\'s' },
                        { href: 'https://www.realnegril.com/beingees/nn230297.htm', text: 'Negril Today - Feb 23, 1997' },
                        { href: 'https://www.realnegril.com/beingees/cheapby2.htm', text: 'Cheap Bite Breakfast' },
                        { href: 'https://www.realnegril.com/beingees/cheapbrk.htm', text: 'Another Breakfast View' },
                        { href: 'https://www.realnegril.com/beingees/sb070397.htm', text: 'Spring Break \'97' },
                        { href: 'https://www.realnegril.com/beingees/bespgbrk.htm', text: 'Spring Break Special' },
                    ].map(link => (
                        <li key={link.href}>
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                                <LinkIcon className="h-4 w-4" />
                                <span>{link.text}</span>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                            </a>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
