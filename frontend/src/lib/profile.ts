/** Static content for the About page, header and footer. */
export type Profile = {
  name: string;
  shortName: string;
  role: string;
  /** Optional image in /public, e.g. "/images/profile.jpg". Initials are shown when unset. */
  avatar?: string;
  intro: string;
  expertise: string[];
  why: string;
  links: { label: string; href: string }[];
};

export const profile: Profile = {
  name: "Hariharan Manoharan",
  shortName: "Hariharan",
  role: "Senior Software Developer · VFX & Deep Learning",
  intro:
    "Hi, I'm Hariharan, a Senior Software Developer specializing in VFX and Deep Learning. With over 9 years of experience, I have worked on AI-powered tools, pipeline automation, and high-performance computing.",
  expertise: [
    "AI & Machine Learning",
    "VFX & Pipeline Development",
    "Python, Django, PyQt/PySide2",
    "Nuke, Silhouette, Unreal Engine",
  ],
  why: "This blog is my way of sharing knowledge on deep learning, AI integration in VFX, and best practices in software development.",
  links: [
    { label: "LinkedIn", href: "https://www.linkedin.com/in/hariharan-manoharan-6b059958/" },
    { label: "GitHub", href: "https://github.com/hariharan849" },
    { label: "Kaggle", href: "https://www.kaggle.com/hariharan849" },
  ],
};
