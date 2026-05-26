import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    // Revalidate the home page path
    revalidatePath('/');
    console.log('Incremental Static Regeneration (ISR) revalidation triggered successfully!');
    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err: any) {
    console.error('Error triggered during revalidation endpoint:', err);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
