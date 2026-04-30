#include <iostream>
#include <cmath>
using namespace std;
int main(){
    
    int N;
    cin >> N;
    
    int num[N], divisao = 0, divPorZero = 0;
    
    for(int i = 0; i < N; i++){
        cin >> num[i];
        divisao = num[i] % 3;
        
        if(divisao == 0){
            divPorZero++;
        }
    }
    
    cout << divPorZero << endl;
}
