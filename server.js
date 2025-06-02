const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
    if (req.path.includes('/payments/')) {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        console.log('Content-Type:', req.headers['content-type']);
        console.log('요청 본문:', req.body);
    }
    next();
});

// 아임포트 API 키
const IMP_KEY = '0120764632601431';
const IMP_SECRET = 'T1CB1emtRRejz1EvZdIdPSJaXy5Qhj3Tr1wrv4N3HiuHqM6ZhQ2b61z08AHxBDn7NIalEB7UKMO3lRGe';

// 아임포트 액세스 토큰 가져오기
async function getAccessToken() {
    try {
        const { data } = await axios.post('https://api.iamport.kr/users/getToken', {
            imp_key: IMP_KEY,
            imp_secret: IMP_SECRET,
        });
        return data.response.access_token;
    } catch (error) {
        console.error('아임포트 토큰 발급 오류:', error.message);
        throw new Error('토큰 발급 실패');
    }
}

// 결제 검증 함수
async function verifyPayment(imp_uid) {
    try {
        const token = await getAccessToken();
        const { data } = await axios.get(`https://api.iamport.kr/payments/${imp_uid}`, {
            headers: { Authorization: token },
        });
        return data.response;
    } catch (error) {
        console.error('결제 정보 조회 오류:', error.message);
        throw error;
    }
}

// 결제 완료 API
app.post('/payments/complete', async (req, res) => {
    try {
        const { imp_uid, merchant_uid } = req.body;

        if (!imp_uid) {
            return res.status(400).json({
                success: false,
                message: 'imp_uid가 필요합니다'
            });
        }

        // 결제 정보 검증
        const paymentData = await verifyPayment(imp_uid);

        // 결제 상태에 따른 처리
        if (paymentData.status === 'paid') {
            // 여기에 DB 저장 로직 구현 (크레딧 추가 등)
            console.log(`결제 완료: 주문번호 ${merchant_uid}, 금액 ${paymentData.amount}원`);

            // TODO: 사용자 크레딧 업데이트 로직
            // const creditAmount = paymentData.amount / 100; // 예: 1000원 = 100 크레딧
            // await updateUserCredit(userId, creditAmount);

            res.json({
                success: true,
                message: '결제가 성공적으로 처리되었습니다',
                payment: paymentData
            });
        } else {
            console.warn(`결제 상태 비정상: ${paymentData.status}`);
            res.json({
                success: false,
                message: `결제 상태가 유효하지 않습니다: ${paymentData.status}`
            });
        }
    } catch (error) {
        console.error('결제 처리 오류:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류: ' + (error.message || '알 수 없는 오류')
        });
    }
});

// 아임포트 웹훅 엔드포인트 (비동기 결제 알림)
app.post('/payments/webhook', async (req, res) => {
    try {
        const { imp_uid, merchant_uid } = req.body;

        if (!imp_uid) {
            return res.status(400).send('imp_uid가 필요합니다');
        }

        // 결제 정보 검증 (실제 결제 여부 확인)
        const paymentData = await verifyPayment(imp_uid);

        if (paymentData.status === 'paid') {
            // TODO: DB에 결제 정보 저장
            console.log(`웹훅 결제 완료: 주문번호 ${merchant_uid}, 금액 ${paymentData.amount}원`);
        } else {
            console.log(`웹훅 결제 실패: ${paymentData.status}`);
        }

        // 웹훅 응답은 간단히 처리 (아임포트는 200 응답만 확인)
        res.status(200).send('ok');
    } catch (error) {
        console.error('웹훅 처리 오류:', error);
        // 웹훅은 재시도될 수 있으므로 에러가 발생해도 200 응답
        res.status(200).send('ok');
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
    console.log(`✅ 크레딧 상점: http://localhost:${PORT}/credit-shop.html`);
});