const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK 추가

const app = express();
const PORT = 3000;

// Firebase Admin 초기화
const serviceAccount = require('../../../src/main/resources/eroom-e6659-firebase-adminsdk-fbsvc-60b39b555b.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://eroom-e6659-default-rtdb.asia-southeast1.firebasedatabase.app"
});

const db = admin.firestore();

// 로깅 미들웨어 추가
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// 미들웨어 설정
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 정적 파일 서빙 (현재 폴더 기준으로 public 폴더)
app.use(express.static(path.join(__dirname, 'public')));

// firebase-config.js 파일을 직접 서빙
app.get('/firebase-config.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'firebase-config.js'));
});

// 기본 루트 - index.html로 이동
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 파아어베이스에서 유저 존재 여부 확인하는 함수 !!
async function checkUserExists(userId) {
    try {
        const querySnapshot = await db.collection('loginHistory')
            .where("userId", "==", userId)
            .get();

        return !querySnapshot.empty;
    } catch (error) {
        console.error('Firebase 유저 확인 오류:', error);
        return false;
    }
}

// 사용자별 크레딧 상점 페이지 (Firebase 검증 추가). url로 접근시 파이어베이스에 있는 유저인지 검사
app.get('/:userId/credit-shop.html', async (req, res) => {
    const userId = req.params.userId;

    console.log(`크레딧 상점 접근 시도 - userId: ${userId}`);

    // 사용자 ID 유효성 검사
    const uidRegex = /^[a-zA-Z0-9_-]{4,20}$/;

    if (!uidRegex.test(userId)) {
        console.log(`유효하지 않은 사용자 ID: ${userId}`);
        return res.redirect('/?error=invalid_format&attempted_id=' + encodeURIComponent(userId));
    }

    // Firebase에서 유저 존재 여부 확인
    const userExists = await checkUserExists(userId);

    if (!userExists) {
        console.log(`Firebase에 존재하지 않는 사용자 ID: ${userId}`);
        return res.redirect('/?error=user_not_found&attempted_id=' + encodeURIComponent(userId));
    }

    // 파일 경로 확인 및 수정
    const fs = require('fs');
    const filePath = path.join(__dirname, 'public', 'credit-shop.html');

    console.log(`파일 경로: ${filePath}`);

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
        console.error(`파일이 존재하지 않습니다: ${filePath}`);
        return res.status(404).send('credit-shop.html 파일을 찾을 수 없습니다.');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('파일 읽기 오류:', err);
            res.status(500).send('파일을 읽을 수 없습니다.');
            return;
        }

        console.log(`파일 읽기 성공 - 사용자 ID: ${userId}`);

        // HTML에 사용자 ID를 자동으로 설정하는 스크립트 추가
        const modifiedHtml = data.replace(
            '</body>',
            `<script>
                // URL에서 사용자 ID 자동 설정
                window.addEventListener('DOMContentLoaded', function() {
                    const userId = '${userId}';
                    sessionStorage.setItem('userId', userId);
                    
                    // 사용자 ID 표시 요소가 있다면 업데이트
                    const userIdElement = document.getElementById('user-id');
                    if (userIdElement) {
                        userIdElement.textContent = userId;
                    }
                    
                    console.log('사용자 ID 자동 설정:', userId);
                });
            </script>
            </body>`
        );

        res.send(modifiedHtml);
    });
});

// 사용자별 결제 성공 페이지 (Firebase 검증 추가)
app.get('/:userId/success.html', async (req, res) => {
    const userId = req.params.userId;

    // 사용자 ID 유효성 검사
    const uidRegex = /^[a-zA-Z0-9_-]{4,20}$/;

    if (!uidRegex.test(userId)) {
        return res.redirect('/?error=invalid_format&attempted_id=' + encodeURIComponent(userId));
    }

    // Firebase에서 유저 존재 여부 확인
    const userExists = await checkUserExists(userId);

    if (!userExists) {
        console.log(`Firebase에 존재하지 않는 사용자 ID: ${userId}`);
        return res.redirect('/?error=user_not_found&attempted_id=' + encodeURIComponent(userId));
    }

    // success.html 파일 확인
    const fs = require('fs');
    const filePath = path.join(__dirname, 'public', 'success.html');

    if (!fs.existsSync(filePath)) {
        console.error(`success.html 파일이 존재하지 않습니다: ${filePath}`);
        return res.status(404).send('success.html 파일을 찾을 수 없습니다.');
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('파일 읽기 오류:', err);
            res.status(500).send('파일을 찾을 수 없습니다.');
            return;
        }

        // HTML에 사용자 ID를 자동으로 설정하는 스크립트 추가
        const modifiedHtml = data.replace(
            '</body>',
            `<script>
                // URL에서 사용자 ID 자동 설정
                window.addEventListener('DOMContentLoaded', function() {
                    const userId = '${userId}';
                    sessionStorage.setItem('userId', userId);
                    
                    console.log('결제 성공 페이지 - 사용자 ID 자동 설정:', userId);
                });
            </script>
            </body>`
        );

        res.send(modifiedHtml);
    });
});

// success 페이지 POST 요청 처리 (HTTP Body로 데이터 수신)
app.post('/:userId/success.html', async (req, res) => {
    const userId = req.params.userId;
    
    // Header에서도 User UniqueID 확인 가능
    const headerUserId = req.headers['user-unique-id'];
    
    console.log(`POST 방식으로 success 페이지 접근 - userId: ${userId}`);
    console.log('전달받은 결제 데이터:', req.body);
    
    // 사용자 ID 유효성 검사
    const uidRegex = /^[a-zA-Z0-9_-]{4,20}$/;
    if (!uidRegex.test(userId)) {
        return res.redirect('/?error=invalid_format&attempted_id=' + encodeURIComponent(userId));
    }
    
    // Firebase에서 유저 존재 여부 확인
    const userExists = await checkUserExists(userId);
    if (!userExists) {
        console.log(`Firebase에 존재하지 않는 사용자 ID: ${userId}`);
        return res.redirect('/?error=user_not_found&attempted_id=' + encodeURIComponent(userId));
    }
    
    // success.html 파일 읽기
    const fs = require('fs');
    const filePath = path.join(__dirname, 'public', 'success.html');
    
    if (!fs.existsSync(filePath)) {
        console.error(`success.html 파일이 존재하지 않습니다: ${filePath}`);
        return res.status(404).send('success.html 파일을 찾을 수 없습니다.');
    }
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('파일 읽기 오류:', err);
            res.status(500).send('파일을 찾을 수 없습니다.');
            return;
        }
        
        // HTML에 결제 데이터를 자동으로 설정하는 스크립트 추가
        const modifiedHtml = data.replace(
            '</body>',
            `<script>
                // HTTP POST로 받은 데이터 설정
                window.addEventListener('DOMContentLoaded', function() {
                    const paymentData = ${JSON.stringify(req.body)};
                    const userId = '${userId}';
                    
                    // 데이터 표시
                    document.getElementById('userId').textContent = userId;
                    document.getElementById('orderId').textContent = paymentData.orderId || '-';
                    document.getElementById('orderName').textContent = paymentData.orderName || '-';
                    document.getElementById('amount').textContent = paymentData.amount ? 
                        Number(paymentData.amount).toLocaleString() + '원' : '-';
                    document.getElementById('method').textContent = paymentData.method || '-';
                    
                    // 뒤로가기 링크 설정
                    const backLink = document.getElementById('back-to-shop');
                    if (backLink) {
                        backLink.setAttribute('href', '/' + userId + '/credit-shop.html');
                    }
                    
                    console.log('HTTP POST로 받은 결제 데이터:', paymentData);
                });
            </script>
            </body>`
        );
        
        res.send(modifiedHtml);
    });
});

// 일반적인 라우트는 구체적인 라우트 뒤에 정의
// 사용자 ID로 접근 시 Firebase 검증 후 리다이렉트
app.get('/:userId', async (req, res) => {
    const userId = req.params.userId;

    console.log(`사용자 ID 접근 - userId: ${userId}`);

    // 사용자 ID 유효성 검사 (4-20자의 영문, 숫자, 하이픈, 언더스코어)
    const uidRegex = /^[a-zA-Z0-9_-]{4,20}$/;

    if (!uidRegex.test(userId)) {
        // 유효하지 않은 ID인 경우 메인 페이지로 리다이렉트
        return res.redirect('/?error=invalid_format&attempted_id=' + encodeURIComponent(userId));
    }

    // Firebase에서 유저 존재 여부 확인
    try {
        const userExists = await checkUserExists(userId);

        if (userExists) {
            // 사용자가 존재하는 경우 크레딧 상점으로 리다이렉트
            console.log('Firebase에서 사용자 ID 확인 완료:', userId);
            res.redirect(`/${userId}/credit-shop.html`);
        } else {
            // 사용자가 존재하지 않는 경우 index로 리다이렉트
            console.log('존재하지 않는 사용자 ID:', userId);
            res.redirect(`/?error=user_not_found&attempted_id=${encodeURIComponent(userId)}`);
        }
    } catch (error) {
        console.error('Firebase 사용자 확인 오류:', error);
        // 오류 발생 시 index로 리다이렉트
        res.redirect(`/?error=verification_failed&attempted_id=${encodeURIComponent(userId)}`);
    }
});

// 아임포트 연동
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
// 결제 핸들러 인듯
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
            console.log(`결제 완료: 주문번호 ${merchant_uid}, 금액 ${paymentData.amount}원`);

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

// 크레딧 구매 정보 처리 엔드포인트
app.post('/purchase', (req, res) => {
    const { uid, creditAmount, timestamp, price } = req.body;

    console.log('크레딧 구매 정보 수신:', {
        uid,
        creditAmount,
        timestamp,
        price
    });

    res.json({
        success: true,
        message: '크레딧 구매 정보가 성공적으로 처리되었습니다',
        data: { uid, creditAmount, timestamp, price }
    });
});

// 사용자 검증 및 결제 데이터 처리 엔드포인트 !! 유저 존재여부 리턴?
app.post('/verify-user-and-payment', async (req, res) => {
    try {
        // Header에서 User UniqueID 추출
        const userId = req.headers['user-unique-id'];
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                userExists: false,
                message: 'User-Unique-ID 헤더가 필요합니다'
            });
        }
        
        console.log(`헤더에서 받은 사용자 ID: ${userId}`);
        
        // Firebase에서 유저 존재 여부 확인
        const userExists = await checkUserExists(userId);
        
        // Body에서 결제 데이터 추출
        const { orderId, amount, orderName, method, paymentKey, creditAmount } = req.body;
        
        // 응답에 유저 존재 여부와 결제 데이터 처리 결과 포함
        if (userExists) {
            console.log(`유효한 사용자 - 결제 데이터 처리: ${userId}`);
            
            res.json({
                success: true,
                userExists: true,
                userId: userId,
                message: '사용자 검증 및 결제 데이터 처리 완료',
                paymentData: {
                    orderId,
                    amount,
                    orderName,
                    method,
                    paymentKey,
                    creditAmount
                }
            });
        } else {
            console.log(`존재하지 않는 사용자: ${userId}`);
            
            res.status(404).json({
                success: false,
                userExists: false,
                message: '존재하지 않는 사용자입니다'
            });
        }
        
    } catch (error) {
        console.error('사용자 검증 오류:', error);
        res.status(500).json({
            success: false,
            userExists: false,
            message: '서버 오류: ' + (error.message || '알 수 없는 오류')
        });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`메인 페이지: http://localhost:${PORT}`);
    console.log(`사용자별 크레딧 상점 예시: http://localhost:${PORT}/user_alice_123`);
});