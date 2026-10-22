"""All fixtures synthetic. Actual publisher/archive HTML is never checked in."""
import unittest
from scripts.m0_wikipedia_rpl_holdout_matrix import CLUBS, compare, wikipedia_scores, publisher_scores


def data():
    labels = list(CLUBS)
    def score(h, a):
        return ((labels.index(h)*3+labels.index(a)) % 5,
                (labels.index(h)+labels.index(a)*2) % 4)
    csv_lines = ["match_id,league_id,season,status,home_id,away_id,home,away,home_goals,away_goals"]
    html = ['<html><title>2025–26 Russian Premier League</title>', '<table class="wikitable">',
            '<tr><th>Home \\ Away</th>'+''.join('<th>'+key+'</th>' for key in labels)+'</tr>']
    count = 0
    for hi,h in enumerate(labels):
        html.append('<tr><th>'+CLUBS[h][0]+'</th>')
        for ai,a in enumerate(labels):
            if h == a:
                html.append('<td>—</td>')
                continue
            count += 1
            hg,ag = score(h,a)
            csv_lines.append(','.join((str(count),'235','2025/2026','finished',
                str(hi+1),str(ai+1),CLUBS[h][0],CLUBS[a][0],str(hg),str(ag))))
            html.append('<td>'+str(hg)+'–'+str(ag)+'</td>')
        html.append('</tr>')
    html += ['</table></html>']
    assert count == 240
    return '\n'.join(csv_lines)+'\n', ''.join(html)


class MatrixTests(unittest.TestCase):
    def test_exact_all_240_agree_without_promoting_holdout(self):
        csv,html = data()
        out=compare(csv,html)
        self.assertTrue(out['recordScoreAgreement'])
        self.assertEqual(out['publisherFixtures'],240)
        self.assertEqual(out['wikipediaFixtures'],240)
        self.assertEqual(out['matchedDirectedFixtures'],240)
        self.assertEqual(out['differentScoreFixtures'],0)
        self.assertFalse(out['productionIngestionApproved'])
        self.assertFalse(out['holdoutLabelDataUsedForTrainingOrCalibration'])
        self.assertFalse(out['officialProtocolTruthVerified'])
        self.assertNotIn('match_id',str(out))
        self.assertNotIn('Akhmat Grozny',str(out))

    def test_single_score_mismatch_detected(self):
        csv,html=data()
        self.assertEqual(html.count('<td>0–2</td>')>0,True)
        # Select first literal fixture cell without touching diagonal.
        html=html.replace('<td>0–2</td>','<td>1–2</td>',1)
        out=compare(csv,html)
        self.assertEqual(out['differentScoreFixtures'],1)
        self.assertEqual(out['homeScoreMismatches'],1)
        self.assertFalse(out['recordScoreAgreement'])

    def test_invalid_score_and_missing_cells_refused(self):
        csv,html=data()
        with self.assertRaisesRegex(ValueError,'wiki'):
            wikipedia_scores(html.replace('<td>—</td>','<td>2–1</td>',1))
        with self.assertRaisesRegex(ValueError,'wiki'):
            wikipedia_scores(html.replace('<td>0–2</td>','<td>NOT PLAYED</td>',1))
        with self.assertRaisesRegex(ValueError,'full season'):
            publisher_scores(csv.replace('2025/2026','2024/2025',1))
        with self.assertRaisesRegex(ValueError,'duplicate'):
            publisher_scores(csv.replace('\n2,235,','\n1,235,',1))

    def test_no_score_derived_club_mapping_and_suppress_sup_footnote(self):
        csv,html=data()
        with self.assertRaisesRegex(ValueError,'identity'):
            publisher_scores(csv.replace('Akhmat Grozny','Unknown Team',1))
        note=html.replace('<td>0–2</td>','<td>0–2<sup>[note]</sup></td>',1)
        self.assertTrue(compare(csv,note)['recordScoreAgreement'])

    def test_incomplete_or_multiple_results_matrices_fail_closed(self):
        csv,html=data()
        self.assertEqual(len(wikipedia_scores(html)),240)
        with self.assertRaisesRegex(ValueError,'one validated'):
            wikipedia_scores(html+html)
        with self.assertRaisesRegex(ValueError,'one validated'):
            wikipedia_scores('<html>Russian Premier League<table><tr><td>hello</td></tr></table></html>')


if __name__ == '__main__':
    unittest.main()
