#include <iostream>
#include <iomanip>

using namespace std;

int main(){
    int N;
    cin >> N;
    int num;
    double media, soma;
    
    for(int i = 0; i < N; i++){
        cin >> num;
        soma += num;
    }
    media = soma / N;
    
    cout << fixed << setprecision(4) << media;
    
    return 0;
}