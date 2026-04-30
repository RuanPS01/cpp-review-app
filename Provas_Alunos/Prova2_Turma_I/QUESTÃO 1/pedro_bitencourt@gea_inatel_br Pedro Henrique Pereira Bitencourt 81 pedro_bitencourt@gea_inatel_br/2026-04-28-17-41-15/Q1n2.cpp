#include <iostream>
using namespace std;
int main(){
    int N, x, z = 0;
    cin >> N;
    for (int i = 0; i < N; i++){
        cin >> x;
        if(x % 3 == 0){
            z++;
        }
    }
    cout << z;
    return 0;
}