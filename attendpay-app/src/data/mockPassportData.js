export const passportMockStates = {
  'external-new': {
    id: 'wk-101',
    name: 'أحمد (جديد)',
    fullName: "Ahmed's Skill Passport",
    type: 'external',
    readinessScore: 40,
    status: 'إعلان ذاتي',
    statusSub: 'SELF DECLARED',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    skills: [
      {
        id: 1,
        title: 'CNC Laser Operator',
        level: 'Intermediate, 4 years',
        score: 50,
        verificationType: 'self',
        verificationText: 'إعلان ذاتي',
        verificationSubText: 'Self-Declared\nلم يتم اختباره'
      },
      {
        id: 2,
        title: 'Arc Welding',
        level: 'Expert, 7 years',
        score: 60,
        verificationType: 'self',
        verificationText: 'إعلان ذاتي',
        verificationSubText: 'Self-Declared\nلم يتم اختباره'
      }
    ]
  },
  'external-tested': {
    id: 'wk-102',
    name: 'أحمد (مختبر)',
    fullName: "Ahmed's Skill Passport",
    type: 'external',
    readinessScore: 75,
    status: 'مختبر ومعتمد',
    statusSub: 'KWADER TESTED',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    skills: [
      {
        id: 1,
        title: 'CNC Laser Operator',
        level: 'Intermediate, 4 years',
        score: 80,
        verificationType: 'kwader',
        verificationText: 'مختبر من كوادر',
        verificationSubText: 'Kwader Tested\nمركز اختبار الرياض'
      },
      {
        id: 2,
        title: 'Arc Welding',
        level: 'Expert, 7 years',
        score: 85,
        verificationType: 'kwader',
        verificationText: 'مختبر من كوادر',
        verificationSubText: 'Kwader Tested\nمركز اختبار الرياض'
      }
    ]
  },
  'internal-verified': {
    id: 'wk-103',
    name: 'أحمد (موثق)',
    fullName: "Ahmed's Skill Passport",
    type: 'internal',
    readinessScore: 95,
    status: 'جاهز للعمل - موثق',
    statusSub: 'EMPLOYER VERIFIED',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    skills: [
      {
        id: 1,
        title: 'CNC Laser Operator',
        level: 'Intermediate, 4 years',
        score: 95,
        verificationType: 'employer',
        verificationText: 'موثق من صاحب العمل',
        verificationSubText: 'Employer Verified\nشركة الصناعات المتقدمة'
      },
      {
        id: 2,
        title: 'Arc Welding',
        level: 'Expert, 7 years',
        score: 92,
        verificationType: 'employer',
        verificationText: 'موثق من صاحب العمل',
        verificationSubText: 'Employer Verified\nشركة الصناعات المتقدمة'
      },
      {
        id: 3,
        title: 'Industrial Maintenance',
        level: 'Advanced, 5 years',
        score: 88,
        verificationType: 'employer',
        verificationText: 'موثق من صاحب العمل',
        verificationSubText: 'Employer Verified\nشركة الصناعات المتقدمة'
      }
    ]
  }
};
