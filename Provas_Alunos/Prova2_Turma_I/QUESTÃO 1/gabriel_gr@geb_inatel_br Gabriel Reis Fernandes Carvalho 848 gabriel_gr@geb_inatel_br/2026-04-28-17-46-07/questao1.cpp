#include <iostream>
using namespace std;

int main (){
    int N, x, num;
    cin >> N;
    
    for( int i = 0; i < N; i++){
        cin >> x;
        if ( x % 3 == 0 && x > num){
            num = x; 
        }
    }
    cout << x << endl;
    return 0;
}