import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const response = await prisma.serviceFormResponse.findUnique({
    where: { id: 'cmqf6p2on000dkw09t000klw5' },
    include: {
      form: true,
      user: true
    }
  });
  if (!response) {
    console.log("Response not found");
    return;
  }

  const responseParticipaField = response.form?.fields 
    ? (response.form.fields as any[]).find((f: any) => f.label.toUpperCase().includes("PARTICIPA")) 
    : null;
  const responseParticipaValue = responseParticipaField && response.answers 
    ? (response.answers as any)[responseParticipaField.id] 
    : "";
  const isResponseGroupCourse = String(responseParticipaValue || "").toUpperCase().includes("GRUP");
  const isResponseCorsistiForm = response.form?.name?.toUpperCase().includes("CORSISTI");
  
  const responseGroupCount = (() => {
    let count = parseInt((response.answers as any)?.["group_participants_count"] || "0", 10);
    if (isResponseGroupCourse && count === 0 && response.answers) {
      let maxIdx = 0;
      for (let i = 1; i <= 10; i++) {
        if ((response.answers as any)[`participant_${i}_name`]) {
          maxIdx = i;
        }
      }
      count = maxIdx > 0 ? maxIdx : 2;
    }
    return count;
  })();

  const isDefaultParticipantField = (fieldLabel: string) => {
    const labelUpper = fieldLabel.toUpperCase();
    return labelUpper === "NOME CORSISTA" || labelUpper === "EMAIL CORSISTA" || labelUpper === "NUMERO CORSISTA";
  };

  console.log("isResponseCorsistiForm:", isResponseCorsistiForm);
  console.log("responseParticipaField:", responseParticipaField);
  console.log("responseParticipaValue:", responseParticipaValue);
  console.log("isResponseGroupCourse:", isResponseGroupCourse);
  console.log("responseGroupCount:", responseGroupCount);
  
  console.log("--- Field Mapping Check ---");
  for (const field of (response.form?.fields as any[])) {
    const isHidden = isResponseCorsistiForm && isResponseGroupCourse && isDefaultParticipantField(field.label);
    console.log(`Field: ${field.label} | isHidden: ${isHidden}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
