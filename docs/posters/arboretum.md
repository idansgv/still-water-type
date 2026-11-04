# Arboretum

**Status:** published 2026-11-04.

Idea (3 Nov 2026), taken from github.com/SkyeShark/SeedThree (procedural trees, Weber–Penn + L-system). Only the idea of species-specific growth rules is borrowed; no code and no forest scene.

**Concept: species as typeface.** The name's centre lines grow as plants. Each letter is one plant rooted at its lowest point. Trunk width follows the pipe model (a branch is as thick as everything it carries), so stems are thick at the root and thin out toward the stroke ends. Each species brings its own twigs, foliage and bark:

- White oak: gnarled, forked twigs, leaf clusters
- Weeping willow: long strands that arch and hang
- Ponderosa pine: straight, short needle sprays, longer near the trunk
- Saguaro: even ribbed tube with spine clusters, no twigs
- Paper birch: outlined white bark with lenticels, fine upward twigs, catkins
- Added 3 Nov 2026: cherry (blossom), Joshua tree (Y-forks, spiky rosettes), Douglas fir (drooping needle tiers), apple (crooked spurs, hanging fruit), dogwood (flat layers, four-bract flowers), wisteria (hanging racemes), bamboo (jointed culms, blade leaves), mangrove (arching prop roots), bonsai juniper (twisted trunk, cloud pads), fern (unrolling fiddleheads), ivy (climbing vine, three-lobed leaves)

Each species keeps its own slider values (`TUNE`); Idan's oak tuning is oak's default.

**Interaction:** load grows the name once (the self-demo). A tap grows it again as the next species with a new seed. Moving across the poster sends wind through the twigs only, so the letters stay legible.

**Method:** text mask → Zhang–Suen thinning → BFS tree from the lowest pixel → prune spurs → per-pixel flow → smoothed chains, with grafts where letter loops meet. Twigs are turtle paths with gravity and wind applied per frame.

Prototype: `docs/posters/prototypes/arboretum.html`. Open questions: which species to keep, trunk weight, and whether the specimen caption stays.

**ez-tree branching (3 Nov 2026):** nine tree species (oak, birch, cherry, apple, dogwood, banyan, bonsai, pine, fir) can grow with a 2D port of github.com/dgreenheck/ez-tree's model (MIT): per-level children/angle/length/radius/taper/gnarliness/start/sections, one growth force, 1/radius scaling of wiggle and bend, stratified children, terminal leaders, and each child's angle around its parent projected to the page. Settings → Branching switches between it and the classic twigs; each model keeps its own slider values.

**Inflorescences and wind (4 Nov 2026, Idan's ask):** flowering tips pick a form from their species' list (umbel, corymb, cyme, solitary, raceme, panicle, dogwood bract heads, hanging and upright catkins, ivy flower balls), and each flower gets its own size, petal count, tilt, single or double petals, and stage (bud, half-open cup, open face). Wind: every twig and branch is a damped spring tuned by its thickness and length; a gust starts at the pointer and crosses the page in its direction, noise breaks it up, limbs overshoot and settle, leaves flutter, and pendants trail behind their twigs.

**Life cycle (3 Nov 2026, Idan's ask):** after the first growth, each limb runs its own clock: grow, hold, age (its foliage drifts down and fades), stand bare, then fade grey while dying back from the tip; a replacement grows somewhere else on the letters. Letters never change. Settings → Life cycle speed (0 turns it off). Note: this is continuous motion at rest, which the site's "no idle motion" rule normally forbids; Idan asked for it, his call at review.
