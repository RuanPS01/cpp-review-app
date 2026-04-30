#include <iostream>
using namespace std;

int main(){
    int N;
    cin >> N;
    
    int num;
    int soma = 0, cont = 0;
    
    for(int i = 0; i < N; i++){
        cin >> num;
        if (num % 3 != 0 )
        soma += num;
        cont ++;
    }
    
    
    cout << soma << endl;
    
    return 0;
}