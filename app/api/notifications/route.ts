import { NextResponse } from 'next/server';
import { getAllIntelligence } from '@/lib/data';

export async function GET() {
  const entries = getAllIntelligence();

  // Return the 10 most recent entries as notifications
  const notifications = entries.slice(0, 10).map(e => ({
    id: e.id,
    headline: e.headline,
    company_name: e.company_name,
    date: e.date,
    type: e.type,
    image_url: e.image_url,
  }));

  return NextResponse.json(notifications);
}
