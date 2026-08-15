import type {
  FilterContext,
  RelatedPostFixture,
  TweetCandidate,
  VisibilityAction,
  VisibilityFeatures,
} from '@/core/types';

type VisibilityCandidate = Pick<
  TweetCandidate,
  | 'authorId'
  | 'hasImage'
  | 'hasVideo'
  | 'isRetweet'
  | 'safetyLabels'
  | 'nsfwAuthor'
  | 'visibilityFeatures'
> & { inNetwork?: boolean };

interface VisibilityVerdict {
  action: VisibilityAction;
  reason?: string;
  decidedBy?: string;
}

interface VisibilityRule {
  name: string;
  action: Exclude<VisibilityAction, 'allow'>;
  reason: string;
  matches: (candidate: VisibilityCandidate, context: FilterContext) => boolean;
}

const NSFW_GATING_COUNTRIES = new Set([
  'ar', 'au', 'br', 'ca', 'de', 'es', 'fr', 'gb', 'id', 'it', 'kr', 'mx', 'nl', 'ph', 'pt', 'th',
]);

const AUTHOR_STATE_RULES: Record<NonNullable<VisibilityFeatures['authorState']>, string> = {
  active: 'ActiveAuthorRule',
  suspended: 'SuspendedAuthorRule',
  deactivated: 'DeactivatedAuthorRule',
  erased: 'ErasedAuthorRule',
  offboarded: 'OffboardedAuthorRule',
};

const BASE_DROP_LABELS = new Map<string, string>([
  ['PDNA', 'PdnaTweetLabelRule'],
  ['BOUNCE', 'BounceTweetLabelRule'],
  ['SPAM', 'SpamTweetLabelRule'],
  ['FOR_EMERGENCY_USE_ONLY', 'ForEmergencyUseOnlyDropRule'],
  ['FOSNR_HATEFUL_CONDUCT', 'FosnrHatefulConductDropRule'],
  ['FOSNR_VIOLENT_SPEECH', 'FosnrViolentSpeechDropRule'],
  ['FOSNR_ABUSE', 'FosnrAbuseDropRule'],
  ['FOSNR_CIVIC_INTEGRITY', 'FosnrCivicIntegrityDropRule'],
]);

const OON_DROP_LABELS = new Map<string, string>([
  ['NSFW_HIGH_RECALL', 'NsfwHighRecallDropRule'],
  ['NSFW_HIGH_PRECISION', 'NsfwHighPrecisionOonDropRule'],
  ['GORE_AND_VIOLENCE_HIGH_PRECISION', 'GoreAndViolenceOonDropRule'],
  ['NSFW_CARD_IMAGE', 'NsfwCardImageOonDropRule'],
  ['DO_NOT_AMPLIFY', 'DoNotAmplifyOonDropRule'],
  ['MALICIOUS_URL', 'MaliciousUrlOonDropRule'],
  ['SPAM_HIGH_RECALL', 'SpamHighRecallDropRule'],
  ['NSFW_TEXT', 'NsfwTextTweetLabelDropRule'],
  ['FOSNR_ABUSE_INSULTS', 'FosnrAbuseInsultsOonDropRule'],
]);

const OON_AUTHOR_DROP_LABELS = new Map<string, { name: string; requireNonFollower: boolean }>([
  ['NSFW_HIGH_RECALL', { name: 'NsfwHighRecallUserLabelRule', requireNonFollower: false }],
  ['NSFW_HIGH_PRECISION', { name: 'NsfwHighPrecisionUserLabelRule', requireNonFollower: false }],
  ['SPAM_HIGH_RECALL', { name: 'SpamHighRecallUserLabelRule', requireNonFollower: false }],
  ['COMPROMISED', { name: 'CompromisedUserLabelRule', requireNonFollower: false }],
  ['READ_ONLY', { name: 'ReadOnlyUserLabelRule', requireNonFollower: false }],
  ['IMPERSONATION_HIGH_PRECISION', { name: 'ImpersonationHighPrecisionUserLabelRule', requireNonFollower: false }],
  ['NSFW_AVATAR_IMAGE', { name: 'NsfwAvatarImageRule', requireNonFollower: false }],
  ['NSFW_BANNER_IMAGE', { name: 'NsfwBannerImageRule', requireNonFollower: false }],
  ['ABUSIVE_HIGH_RECALL', { name: 'AbusiveHighRecallRule', requireNonFollower: true }],
  ['NSFW_NEAR_PERFECT', { name: 'NsfwNearPerfectAuthorRule', requireNonFollower: false }],
  ['DO_NOT_AMPLIFY', { name: 'DoNotAmplifyNonFollowerRule', requireNonFollower: true }],
]);

function labels(candidate: VisibilityCandidate): Set<string> {
  return new Set((candidate.safetyLabels || []).map((label) => label.toUpperCase()));
}

function authorLabels(candidate: VisibilityCandidate): Set<string> {
  return new Set(
    (candidate.visibilityFeatures?.authorSafetyLabels || []).map((label) => label.toUpperCase())
  );
}

function isAuthorViewer(candidate: VisibilityCandidate, context: FilterContext): boolean {
  return !context.viewerLoggedOut && candidate.authorId === context.currentUserId;
}

function viewerFollowsAuthor(candidate: VisibilityCandidate, context: FilterContext): boolean {
  return context.followedAuthorIds.includes(candidate.authorId);
}

function isNsfwFlagged(candidate: VisibilityCandidate): boolean {
  const features = candidate.visibilityFeatures;
  return Boolean(
    features?.authorNsfwUser ||
    features?.authorNsfwAdmin ||
    features?.tweetNsfwUser ||
    features?.tweetNsfwAdmin ||
    candidate.nsfwAuthor
  );
}

function isSensitive(candidate: VisibilityCandidate): boolean {
  const candidateLabels = labels(candidate);
  const hasMedia = candidate.hasImage || candidate.hasVideo;
  const nsfwFlagged = isNsfwFlagged(candidate);
  const nsfwMedia = hasMedia && (
    candidateLabels.has('NSFW_HIGH_PRECISION') ||
    candidateLabels.has('NSFW_HIGH_RECALL') ||
    (nsfwFlagged && !candidate.isRetweet)
  );
  const graphicMedia = hasMedia && candidateLabels.has('GORE_AND_VIOLENCE_HIGH_PRECISION');
  const noMediaLabel = candidateLabels.has('NSFW_TEXT') || candidateLabels.has('NSFW_CARD_IMAGE');
  return nsfwMedia || graphicMedia || noMediaLabel;
}

function firstMatchingLabel(
  candidateLabels: Set<string>,
  rules: Map<string, string>
): { label: string; ruleName: string } | undefined {
  for (const [label, ruleName] of rules) {
    if (candidateLabels.has(label)) return { label, ruleName };
  }
  return undefined;
}

function evaluateRules(
  rules: VisibilityRule[],
  candidate: VisibilityCandidate,
  context: FilterContext
): VisibilityVerdict {
  let interstitial: VisibilityVerdict | undefined;
  for (const rule of rules) {
    if (!rule.matches(candidate, context)) continue;
    if (rule.action === 'drop') {
      return { action: 'drop', reason: rule.reason, decidedBy: rule.name };
    }
    interstitial ??= { action: 'interstitial', reason: rule.reason, decidedBy: rule.name };
  }
  return interstitial ?? { action: 'allow' };
}

function baseRules(candidate: VisibilityCandidate, context: FilterContext): VisibilityRule[] {
  const features = candidate.visibilityFeatures;
  const candidateLabels = labels(candidate);
  const selfView = isAuthorViewer(candidate, context);
  const baseLabel = [...BASE_DROP_LABELS]
    .filter(([label]) => candidateLabels.has(label))
    .find(([label]) => !selfView || label === 'FOR_EMERGENCY_USE_ONLY');
  const requestCountry = context.viewerCountryCode?.toLowerCase();
  const ageGatingCountry = context.viewerAccountCountryCode?.toLowerCase() || requestCountry;
  const withheldIn = (countries: string[] | undefined) => Boolean(
    !selfView && requestCountry && countries?.some((country) => country.toLowerCase() === requestCountry)
  );

  return [
    {
      name: AUTHOR_STATE_RULES[features?.authorState || 'active'],
      action: 'drop',
      reason: `author_${features?.authorState || 'inactive'}`,
      matches: () => !selfView && Boolean(features?.authorState && features.authorState !== 'active'),
    },
    {
      name: 'ProtectedAuthorDropRule', action: 'drop', reason: 'author_protected',
      matches: () => Boolean(features?.authorProtected && !selfView && (
        context.viewerLoggedOut || !viewerFollowsAuthor(candidate, context)
      )),
    },
    {
      name: 'ViewerBlocksAuthorRule', action: 'drop', reason: 'viewer_blocks_author',
      matches: () => !context.viewerLoggedOut && context.blockedUsers.includes(candidate.authorId),
    },
    {
      name: 'ViewerMutesAuthorRule', action: 'drop', reason: 'viewer_mutes_author',
      matches: () => !context.viewerLoggedOut && context.mutedUsers.includes(candidate.authorId),
    },
    {
      name: 'MutedRetweetsRule', action: 'drop', reason: 'viewer_mutes_retweets_from_author',
      matches: () => !context.viewerLoggedOut && candidate.isRetweet && Boolean(features?.viewerMutesRetweetsFromAuthor),
    },
    {
      name: baseLabel?.[1] || 'TweetLabelDropRule', action: 'drop', reason: baseLabel?.[0] || 'tweet_label',
      matches: () => Boolean(baseLabel),
    },
    {
      name: 'NullcastedTweetDropRule', action: 'drop', reason: 'tweet_nullcast',
      matches: () => Boolean(features?.nullcasted && !candidate.isRetweet && !features.communityTweet),
    },
    {
      name: 'DropStaleTweetsRule', action: 'drop', reason: 'tweet_stale',
      matches: () => Boolean(features?.stale && !candidate.isRetweet && !features.hasSourceTweet),
    },
    {
      name: 'DropLegalTakendownPostRule', action: 'drop', reason: 'legal_takedown',
      matches: () => withheldIn(features?.legalTakedownCountries),
    },
    {
      name: 'DropLocalLawsTakendownPostRule', action: 'drop', reason: 'local_law_takedown',
      matches: () => withheldIn(features?.localLawTakedownCountries),
    },
    {
      name: 'SensitiveViewerLoggedOutDropRule', action: 'drop', reason: 'sensitive_logged_out',
      matches: () => context.viewerLoggedOut && !selfView && isSensitive(candidate),
    },
    {
      name: 'SensitiveViewerUnderageDropRule', action: 'drop', reason: 'sensitive_underage',
      matches: () => context.viewerAge.status === 'known' &&
        context.viewerAge.age < 18 && !selfView && isSensitive(candidate),
    },
    {
      name: 'SensitiveViewerNoStatedAgeDropRule', action: 'drop', reason: 'sensitive_no_stated_age',
      matches: () => context.viewerAge.status === 'not_stated' && Boolean(
        ageGatingCountry && NSFW_GATING_COUNTRIES.has(ageGatingCountry) && !selfView && isSensitive(candidate)
      ),
    },
    {
      name: 'DropExclusiveTweetContentRule', action: 'drop', reason: 'exclusive_tweet',
      matches: () => Boolean(
        features?.exclusiveContent &&
        !features.viewerCanSeeExclusiveContent &&
        (!selfView || candidate.isRetweet)
      ),
    },
    {
      name: 'NsfwHighPrecisionInterstitialRule', action: 'interstitial', reason: 'contain_nsfw_media',
      matches: () => !selfView && !context.viewerAllowsSensitiveMedia && candidateLabels.has('NSFW_HIGH_PRECISION'),
    },
    {
      name: 'GoreAndViolenceInterstitialRule', action: 'interstitial', reason: 'contain_nsfw_media',
      matches: () => !selfView && !context.viewerAllowsSensitiveMedia && candidateLabels.has('GORE_AND_VIOLENCE_HIGH_PRECISION'),
    },
    {
      name: 'NsfwCardImageInterstitialRule', action: 'interstitial', reason: 'contain_nsfw_media',
      matches: () => !selfView && !context.viewerAllowsSensitiveMedia && candidateLabels.has('NSFW_CARD_IMAGE'),
    },
    {
      name: 'NsfwAuthorInterstitialRule', action: 'interstitial', reason: 'contain_nsfw_media',
      matches: () => !selfView && !context.viewerAllowsSensitiveMedia &&
        (candidate.hasImage || candidate.hasVideo) && isNsfwFlagged(candidate),
    },
  ];
}

function recommendationRules(candidate: VisibilityCandidate, context: FilterContext): VisibilityRule[] {
  const features = candidate.visibilityFeatures;
  const candidateLabels = labels(candidate);
  const candidateAuthorLabels = authorLabels(candidate);
  const selfView = isAuthorViewer(candidate, context);
  const oonTweetLabel = firstMatchingLabel(candidateLabels, OON_DROP_LABELS);
  let oonAuthorLabel: { label: string; name: string; requireNonFollower: boolean } | undefined;
  for (const [label, config] of OON_AUTHOR_DROP_LABELS) {
    if (candidateAuthorLabels.has(label)) {
      oonAuthorLabel = { label, ...config };
      break;
    }
  }
  const country = context.viewerCountryCode?.toLowerCase() || 'xx';
  const geoBlocked = Boolean(
    (features?.geoAllowCountries?.length && !features.geoAllowCountries.some((item) => item.toLowerCase() === country)) ||
    features?.geoDenyCountries?.some((item) => item.toLowerCase() === country)
  );

  return [
    { name: 'DropTweetsWithDmcaMediaRule', action: 'drop', reason: 'dmca_media', matches: () => Boolean(features?.dmcaMedia) },
    { name: 'DropTweetsWithGeoRestrictedMediaRule', action: 'drop', reason: 'geo_restricted_media', matches: () => geoBlocked },
    { name: 'DropNsfwUserAuthorRule', action: 'drop', reason: 'nsfw_user_author', matches: () => !selfView && Boolean(features?.authorNsfwUser || candidate.nsfwAuthor) },
    { name: 'DropNsfwAdminAuthorRule', action: 'drop', reason: 'nsfw_admin_author', matches: () => !selfView && Boolean(features?.authorNsfwAdmin) },
    { name: 'TweetNsfwUserDropRule', action: 'drop', reason: 'tweet_nsfw_user', matches: () => Boolean(features?.tweetNsfwUser) },
    { name: 'TweetNsfwAdminDropRule', action: 'drop', reason: 'tweet_nsfw_admin', matches: () => Boolean(features?.tweetNsfwAdmin) },
    {
      name: oonTweetLabel?.ruleName || 'OonTweetLabelDropRule', action: 'drop', reason: oonTweetLabel?.label || 'oon_tweet_label',
      matches: () => Boolean(oonTweetLabel && !selfView),
    },
    {
      name: oonAuthorLabel?.name || 'OonAuthorLabelDropRule', action: 'drop', reason: oonAuthorLabel?.label || 'oon_author_label',
      matches: () => Boolean(
        oonAuthorLabel &&
        !selfView &&
        (!oonAuthorLabel.requireNonFollower ||
          context.viewerLoggedOut ||
          !viewerFollowsAuthor(candidate, context))
      ),
    },
  ];
}

/** Evaluates the published home timeline policy order; the first drop wins. */
export function evaluateVisibility(
  candidate: VisibilityCandidate,
  context: FilterContext,
  policy?: 'timeline_home' | 'timeline_home_recommendations'
): VisibilityVerdict {
  const useTimelineHome = policy
    ? policy === 'timeline_home'
    : candidate.inNetwork === true;
  const rules = useTimelineHome
    ? baseRules(candidate, context)
    : [...baseRules(candidate, context), ...recommendationRules(candidate, context)];
  return evaluateRules(rules, candidate, context);
}

function relatedPostDrops(
  fixture: RelatedPostFixture | undefined,
  context: FilterContext,
  policy: 'timeline_home' | 'timeline_home_recommendations'
): boolean {
  return Boolean(fixture && evaluateVisibility(fixture, context, policy).action === 'drop');
}

export function hydrateVisibility(
  candidates: TweetCandidate[],
  context: FilterContext
): TweetCandidate[] {
  return candidates.map((candidate) => {
    const verdict = evaluateVisibility(candidate, context);
    const tombstones = new Set(candidate.tombstoneAncestorIds || []);
    const ancestorDrops = (candidate.ancestors || []).some((id) =>
      !tombstones.has(id) && relatedPostDrops(
        candidate.relatedPosts?.[id],
        context,
        'timeline_home_recommendations'
      )
    );
    const quotedDrops = Boolean(candidate.quotedTweetId && relatedPostDrops(
      candidate.relatedPosts?.[candidate.quotedTweetId],
      context,
      'timeline_home_recommendations'
    ));
    const retweetDrops = Boolean(candidate.originalTweetId && relatedPostDrops(
      candidate.relatedPosts?.[candidate.originalTweetId],
      context,
      'timeline_home'
    ));
    return {
      ...candidate,
      visibilityAction: verdict.action,
      visibilityReason: verdict.reason,
      visibilityDecidedBy: verdict.decidedBy,
      dropAncillaryPosts: ancestorDrops || quotedDrops || retweetDrops,
    };
  });
}
